const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// Handle large photo uploads securely
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = "mongodb+srv://ict24067_db_user:xA6UNyQrqOkhMEhK@cluster0.2axxnyj.mongodb.net/uwumart?appName=Cluster0";

async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
}

// --- DATABASES INTERFACES ---
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
    password: { type: String, required: true }
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

// --- ENDPOINTS ---
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email required." });
        
        email = email.toLowerCase().trim();
        if (!(/^[a-zA-Z0-9._%+-]+@std\.uwu\.ac\.lk$/).test(email)) {
            return res.status(400).json({ success: false, message: "Only @std.uwu.ac.lk email is allowed." });
        }

        const existingOtp = await OtpModel.findOne({ email });
        if (existingOtp && (Date.now() - new Date(existingOtp.lastSentAt).getTime() < 60000)) {
            return res.status(400).json({ success: false, message: "Please wait 60 seconds before resending." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' }
        });

        await transporter.sendMail({
            from: '"UWU Mart" <sspmaduthisara@gmail.com>',
            to: email,
            subject: 'UWU Mart Verification Code',
            text: `Your verification code is: ${otp}`
        });

        await OtpModel.findOneAndUpdate({ email }, { otp, createdAt: new Date(), lastSentAt: new Date() }, { upsert: true });
        res.json({ success: true, message: "Verification code sent to email." });
    } catch (e) { res.status(500).json({ success: false, message: "OTP Send Failure." }); }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, name, studentId, phone, photoUrl, role, password } = req.body;
        email = email.toLowerCase().trim();

        const otpRecord = await OtpModel.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return res.status(400).json({ success: false, message: "Invalid/Expired OTP." });

        const newUser = new User({ email, name, studentId, phone, photoUrl, role, password });
        await newUser.save();
        await OtpModel.deleteOne({ email });
        res.json({ success: true, message: "Registration completely successful!" });
    } catch (e) { res.status(500).json({ success: false, message: "User already exists or inputs invalid." }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        await connectDB();
        let { email, password } = req.body;
        email = email.toLowerCase().trim();

        const user = await User.findOne({ email });
        if (!user) return res.status(444).json({ success: false, message: "Account non-existent." });
        if (user.password !== password) return res.status(400).json({ success: false, message: "Wrong password." });

        res.json({ success: true, message: "Logged in.", user: { email: user.email, name: user.name, photoUrl: user.photoUrl } });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body; email = email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if(!user) return res.status(404).json({ success: false, message: "Account not found." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        let transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' } });
        await transporter.sendMail({ from: '"UWU Mart"', to: email, subject: 'Reset Pass', text: `Code: ${otp}` });
        
        await OtpModel.findOneAndUpdate({ email }, { otp, createdAt: new Date(), lastSentAt: new Date() }, { upsert: true });
        res.json({ success: true, message: "Reset code dispatched." });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, newPassword } = req.body; email = email.toLowerCase().trim();
        const otpRecord = await OtpModel.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return res.status(400).json({ success: false, message: "Invalid OTP." });

        await User.findOneAndUpdate({ email }, { password: newPassword });
        await OtpModel.deleteOne({ email });
        res.json({ success: true, message: "Password updated successfully." });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/items/post', async (req, res) => {
    try {
        await connectDB();
        const newItem = new Item(req.body);
        await newItem.save();
        res.json({ success: true, message: "Ad published!" });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.get('/api/items', async (req, res) => {
    try {
        await connectDB();
        const items = await Item.find().sort({ createdAt: -1 });
        res.json(items);
    } catch(e) { res.status(500).json([]); }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        const { email } = req.body;
        const item = await Item.findById(id);
        if (email === 'ict24067@std.uwu.ac.lk' || item.sellerEmail === email) {
            await Item.findByIdAndDelete(id);
            return res.json({ success: true, message: "Ad deleted cleanly." });
        }
        res.status(403).json({ message: "Unauthorized." });
    } catch(e) { res.status(500).json({ message: "Error." }); }
});

app.listen(3000, () => console.log(`🚀 Server up on port 3000`));
