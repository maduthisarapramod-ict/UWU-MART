const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = "mongodb+srv://ict24067_db_user:xA6UNyQrqOkhMEhK@cluster0.2axxnyj.mongodb.net/uwumart?appName=Cluster0";

async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
}

// --- 🗂️ MONGODB SCHEMAS CONFIGURATIONS ---
const OtpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 }, 
    lastSentAt: { type: Date, default: Date.now }
});
const OtpModel = mongoose.model('Otp', OtpSchema);

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

// --- 🔒 API CONTROLLER NETWORKS ---

// 👑 ADMIN PORTAL AUTH CHECK
app.get('/api/admin/users', async (req, res) => {
    try {
        await connectDB();
        if (req.query.adminEmail !== 'ict24067@std.uwu.ac.lk') {
            return res.status(403).json({ success: false, message: "Unauthorized." });
        }
        const userDirectory = await User.find({}, '-password').sort({ createdAt: -1 });
        res.json({ success: true, users: userDirectory });
    } catch(e) { res.status(500).json({ success: false }); }
});

// DELIVERIES RIDERS DIRECTORY GATEWAY
app.get('/api/riders', async (req, res) => {
    try {
        await connectDB();
        const activeRiders = await User.find({ role: 'Delivery' }, 'name studentId phone photoUrl').sort({ createdAt: -1 });
        res.json(activeRiders);
    } catch(e) { res.status(500).json([]); }
});

// OTP EMAIL ISSUING SERVICE
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body; if (!email) return res.status(400).json({ success: false, message: "Email required." });
        email = email.toLowerCase().trim();

        if (!(/^[a-zA-Z0-9._%+-]+@std\.uwu\.ac\.lk$/).test(email)) {
            return res.status(400).json({ success: false, message: "Only @std.uwu.ac.lk email is allowed." });
        }

        const existingOtp = await OtpModel.findOne({ email });
        if (existingOtp && (Date.now() - new Date(existingOtp.lastSentAt).getTime() < 60000)) {
            return res.status(400).json({ success: false, message: "Wait 60 seconds before resending code." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' }
        });

        await transporter.sendMail({
            from: '"UWU Mart Engine" <sspmaduthisara@gmail.com>',
            to: email,
            subject: 'Your UWU Mart OTP Code',
            text: `Your security code token is: ${otp}`
        });

        await OtpModel.findOneAndUpdate({ email }, { otp, createdAt: new Date(), lastSentAt: new Date() }, { upsert: true });
        res.json({ success: true, message: "Code dispatched into your inbox." });
    } catch (e) { res.status(500).json({ success: false, message: "Nodemailer dispatch engine broken down." }); }
});

// ACCOUNT INSCRIPTION CREATION
app.post('/api/auth/register', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, name, studentId, phone, photoUrl, role, password } = req.body;
        email = email.toLowerCase().trim();

        const otpRecord = await OtpModel.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return res.status(400).json({ success: false, message: "Incorrect OTP Token." });

        const newUser = new User({ email, name, studentId, phone, photoUrl, role, password });
        await newUser.save();
        await OtpModel.deleteOne({ email });
        res.json({ success: true, message: "Registration successful!" });
    } catch (e) { res.status(500).json({ success: false, message: "User identity parameters conflict." }); }
});

// AUTHENTICATION ACCESS DOOR
app.post('/api/auth/login', async (req, res) => {
    try {
        await connectDB();
        let { email, password } = req.body; email = email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if (!user) return res.status(444).json({ success: false });
        if (user.password !== password) return res.status(400).json({ success: false, message: "Wrong credentials." });
        res.json({ success: true, message: "Welcome!", user: { email: user.email, name: user.name, photoUrl: user.photoUrl } });
    } catch (e) { res.status(500).json({ success: false }); }
});

// INDIVIDUAL SPECIFIC ITEM INQUIRY
app.get('/api/items/details/:id', async (req, res) => {
    try {
        await connectDB();
        const item = await Item.findById(req.params.id);
        res.json(item);
    } catch(e) { res.status(404).json(null); }
});

// MARKET DATA POST PUBLISHING
app.post('/api/items/post', async (req, res) => {
    try {
        await connectDB();
        const newItem = new Item(req.body);
        await newItem.save();
        res.json({ success: true, message: "Post indexed live!" });
    } catch(e) { res.status(500).json({ success: false }); }
});

// STREAM RECENT GRID ENTRIES (NEWEST POST FIRST VIA SORT CRITERIA)
app.get('/api/items', async (req, res) => {
    try {
        await connectDB();
        const { category, search } = req.query;
        let queryObj = {};
        
        if (category && category !== "All") queryObj.category = category;
        if (search) queryObj.title = { $regex: search, $options: 'i' }; // Search Filter Condition Case Insensitive

        // ⏱️ ALWAYS SORT BY NEWEST FIRST USING (-1)
        const entries = await Item.find(queryObj).sort({ createdAt: -1 });
        res.json(entries);
    } catch(e) { res.status(500).json([]); }
});

// MUTATION DELETE RECORD ROUTE LOCK
app.delete('/api/items/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params; const { email } = req.body;
        const target = await Item.findById(id);
        
        // 👑 Security Permission Condition check: Creator OR Master Admin Email
        if (email === 'ict24067@std.uwu.ac.lk' || target.sellerEmail === email) {
            await Item.findByIdAndDelete(id);
            return res.json({ success: true, message: "Post removed permanently." });
        }
        res.status(403).json({ message: "Access unauthorized." });
    } catch(e) { res.status(500).json({ message: "Server Mutation Failure." }); }
});

// PASSWORD RESTORATIONS CONTROLLERS
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body; email = email.toLowerCase().trim();
        const user = await User.findOne({ email }); if(!user) return res.status(404).json({ success: false, message: "Email not registered." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' } });
        await transporter.sendMail({ from: '"UWU Mart"', to: email, subject: 'Password Recovery Token', text: `Code Token: ${otp}` });
        
        await OtpModel.findOneAndUpdate({ email }, { otp, createdAt: new Date(), lastSentAt: new Date() }, { upsert: true });
        res.json({ success: true, message: "Token recovery key sent." });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, newPassword } = req.body; email = email.toLowerCase().trim();
        const token = await OtpModel.findOne({ email });
        if (!token || token.otp !== otp) return res.status(400).json({ success: false, message: "Invalid verification." });

        await User.findOneAndUpdate({ email }, { password: newPassword });
        await OtpModel.deleteOne({ email });
        res.json({ success: true, message: "Password updated." });
    } catch (e) { res.status(500).json({ success: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 System Online Matrix Synchronized on Port ${PORT}`));
