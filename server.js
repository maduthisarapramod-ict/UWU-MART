const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔒 1. ඩේටාබේස් සම්බන්ධතාවය (Database Connection)
const MONGO_URI = "mongodb+srv://ict24067_db_user:xA6UNyQrqOkhMEhK@cluster0.2axxnyj.mongodb.net/uwumart?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log("🟢 UWU Mart DB Connected - Data Secured!"))
    .catch(err => console.error("🔴 DB Connection Error:", err));

// --- 🗂️ DATABASE SCHEMAS ---

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    studentId: { type: String, required: true },
    phone: { type: String, required: true },
    photoUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' },
    role: { type: String, enum: ['Student', 'Delivery'], default: 'Student' },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const ItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    whatsapp: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    sellerEmail: { type: String, required: true },
    sellerName: { type: String },
    createdAt: { type: Date, default: Date.now }
});
const Item = mongoose.model('Item', ItemSchema);

let otpCache = {};

// --- 🌐 API ENDPOINTS ---

// 1. Send OTP (Strict Validation)
app.post('/api/auth/send-otp', async (req, res) => {
    const { email } = req.body;
    const uwuEmailRegex = /^[a-zA-Z0-9._%+-]+@std\.uwu\.ac\.lk$/;

    if (!uwuEmailRegex.test(email)) {
        return res.status(400).json({ success: false, message: "ඇතුළත් කළ හැක්කේ @std.uwu.ac.lk ඊමේල් පමණි!" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCache[email] = otp;

    // 🔒 2. ඔයාගේ පුද්ගලික GMAIL එක සහ APP PASSWORD එක මෙතනට සෙට් කර ඇත
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'sspmaduthisara@gmail.com', 
            pass: 'iway yrzc epgs hkoa' 
        }
    });

    let mailOptions = {
        from: '"UWU Mart" <sspmaduthisara@gmail.com>',
        to: email,
        subject: 'UWU Mart Verification Code',
        text: `UWU Mart ගිණුම තහවුරු කිරීමට කේතය: ${otp}`
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) return res.status(500).json({ success: false, message: "OTP යැවීමට අපොහොසත් විය." });
        res.json({ success: true, message: "OTP කේතය සාර්ථකව Campus Email එකට යවන ලදි!" });
    });
});

// 2. Register User
app.post('/api/auth/register', async (req, res) => {
    const { email, otp, name, studentId, phone, photoUrl, role, password } = req.body;

    if (otpCache[email] !== otp) {
        return res.status(400).json({ success: false, message: "වැරදි OTP කේතයකි!" });
    }

    try {
        const newUser = new User({ email, name, studentId, phone, photoUrl, role, password });
        await newUser.save();
        delete otpCache[email];
        res.json({ success: true, message: "ලියාපදිංචි වීම සාර්ථකයි! දැන් ලොග් වෙන්න." });
    } catch (err) {
        res.status(500).json({ success: false, message: "ඊමේල් එක දැනටමත් භාවිතයේ පවතී." });
    }
});

// 3. Login User
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(400).json({ success: false, message: "ඊමේල් හෝ මුරපදය වැරදියි!" });
    res.json({ success: true, user: { email: user.email, name: user.name, role: user.role, photoUrl: user.photoUrl } });
});

// 4. Post New Advertisement
app.post('/api/items/post', async (req, res) => {
    const { title, price, category, location, whatsapp, description, imageUrl, sellerEmail, sellerName } = req.body;
    try {
        const newItem = new Item({ title, price, category, location, whatsapp, description, imageUrl, sellerEmail, sellerName });
        await newItem.save();
        res.json({ success: true, message: "දැන්වීම සාර්ථකව පළ කරන ලදි!" });
    } catch (err) {
        res.status(500).json({ success: false, message: "පළ කිරීමට නොහැකි විය." });
    }
});

// 5. Get Filtered Items (Sorted by Time: Live Newest First)
app.get('/api/items', async (req, res) => {
    const { search, category } = req.query;
    let query = {};
    
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const items = await Item.find(query).sort({ createdAt: -1 });
    res.json(items);
});

// 6. Global Delete API (WithOwner & Super Admin Access)
app.delete('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    
    const item = await Item.findById(id);
    if (!item) return res.status(404).json({ message: "දැන්වීම හමු නොවීය." });
    
    // MASTER ACCESS LOCK: ඔයාගේ Email එකට විතරක් ඕනෑම කෙනෙක්ගේ එකක් මැකීමේ බලය ලැබේ
    if (email === 'ict24067@std.uwu.ac.lk' || item.sellerEmail === email) {
        await Item.findByIdAndDelete(id);
        return res.json({ success: true, message: "දැන්වීම සාර්ථකව මකා දමන ලදි." });
    }
    
    res.status(403).json({ message: "මෙම දැන්වීම මැකීමට ඔබට අවසර නැත!" });
});

// 7. Admin Analytics (STRICT PRIVACY LOCK FOR NORMAL USERS)
app.get('/api/admin/dashboard', async (req, res) => {
    const adminEmail = req.headers['admin-email'];
    
    // SECURITY BLOCK: ict24067@std.uwu.ac.lk හැර වෙනත් කිසිම කෙනෙකුට දත්ත බැලීමට ඉඩ නොදේ
    if (adminEmail !== 'ict24067@std.uwu.ac.lk') {
        return res.status(403).json({ message: "Access Denied: මේ දත්ත බැලීමට අවසර ඇත්තේ ප්‍රධාන Admin ට පමණි!" });
    }
    
    const totalUsers = await User.countDocuments();
    const totalItems = await Item.countDocuments();
    const allUsers = await User.find().sort({ createdAt: -1 });
    res.json({ totalUsers, totalItems, allUsers });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 UWU Mart running on http://localhost:${PORT}`));
