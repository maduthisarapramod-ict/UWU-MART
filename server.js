const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();

// 📸 GALLERY PHOTO OPTIMIZATION: Allows large Base64 image strings from gallery
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = "mongodb+srv://ict24067_db_user:xA6UNyQrqOkhMEhK@cluster0.2axxnyj.mongodb.net/uwumart?appName=Cluster0";

// 🚀 Fixed Vercel Serverless Connection Overhead
async function connectDB() {
    if (mongoose.connection.readyState >= 1) return;
    return mongoose.connect(MONGO_URI);
}

// --- 🗂️ DATABASE SCHEMAS ---
const OtpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 300 }, 
    lastSentAt: { type: Date, default: Date.now } // Tracks 60-second cooldown
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

// --- 🌐 API ENDPOINTS ---

// 1. Send OTP (With 60s Spam Protection Cooldown)
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email address is required." });
        
        email = email.toLowerCase().trim();
        const uwuEmailRegex = /^[a-zA-Z0-9._%+-]+@std\.uwu\.ac\.lk$/;

        if (!uwuEmailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Only @std.uwu.ac.lk email addresses are allowed." });
        }

        // ⏱️ Cooldown Check
        const existingOtp = await OtpModel.findOne({ email });
        if (existingOtp) {
            const timePassed = Date.now() - new Date(existingOtp.lastSentAt).getTime();
            if (timePassed < 60000) {
                const secondsLeft = Math.ceil((60000 - timePassed) / 1000);
                return res.status(400).json({ 
                    success: false, 
                    message: `Please wait ${secondsLeft} seconds before requesting a new OTP.` 
                });
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' }
        });

        let mailOptions = {
            from: '"UWU Mart" <sspmaduthisara@gmail.com>',
            to: email,
            subject: 'UWU Mart Verification Code',
            text: `Your UWU Mart verification code is: ${otp}. Valid for 5 minutes.`
        };

        // Fixed Vercel Lambda Execution Timeout
        await transporter.sendMail(mailOptions);

        await OtpModel.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date(), lastSentAt: new Date() },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "Verification code sent to your campus email." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to process OTP request. Try again." });
    }
});

// 2. Register User (Saves Base64 Image)
app.post('/api/auth/register', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, name, studentId, phone, photoUrl, role, password } = req.body;
        if (!email || !otp || !name || !password) return res.status(400).json({ success: false, message: "Required fields are missing." });
        
        email = email.toLowerCase().trim();

        const otpRecord = await OtpModel.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP code." });
        }

        const newUser = new User({ email, name, studentId, phone, photoUrl, role, password });
        await newUser.save();
        
        await OtpModel.deleteOne({ email });
        res.json({ success: true, message: "Registration successful! You can now log in." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Email already exists or a database error occurred." });
    }
});

// 3. Login User (Autocheck: Redirects with code 444 if unregistered)
app.post('/api/auth/login', async (req, res) => {
    try {
        await connectDB();
        let { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: "Please provide both email and password." });

        email = email.toLowerCase().trim();

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(444).json({ success: false, message: "Account does not exist. Please register first." });
        }

        if (user.password !== password) {
            return res.status(400).json({ success: false, message: "Invalid password. Please try again." });
        }
        
        res.json({ 
            success: true, 
            message: "Login successful.",
            user: { email: user.email, name: user.name, role: user.role, photoUrl: user.photoUrl } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error encountered during login." });
    }
});

// 4. Forget Password - Step 1: Request Reset Code
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        await connectDB();
        let { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        email = email.toLowerCase().trim();
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "No account found with this campus email." });

        // Cooldown Check for Password Reset OTP
        const existingOtp = await OtpModel.findOne({ email });
        if (existingOtp) {
            const timePassed = Date.now() - new Date(existingOtp.lastSentAt).getTime();
            if (timePassed < 60000) {
                const secondsLeft = Math.ceil((60000 - timePassed) / 1000);
                return res.status(400).json({ success: false, message: `Please wait ${secondsLeft} seconds before requesting another code.` });
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: 'sspmaduthisara@gmail.com', pass: 'iway yrzc epgs hkoa' }
        });

        await transporter.sendMail({
            from: '"UWU Mart" <sspmaduthisara@gmail.com>',
            to: email,
            subject: 'UWU Mart Password Reset Code',
            text: `Your code to reset UWU Mart password is: ${otp}. Valid for 5 minutes.`
        });

        await OtpModel.findOneAndUpdate(
            { email }, 
            { otp, createdAt: new Date(), lastSentAt: new Date() }, 
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "Password reset OTP sent to your campus email." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error occurred during reset request." });
    }
});

// 5. Forget Password - Step 2: Verify & Update
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        await connectDB();
        let { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: "All fields are required." });

        email = email.toLowerCase().trim();
        const otpRecord = await OtpModel.findOne({ email });

        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset OTP code." });
        }

        await User.findOneAndUpdate({ email }, { password: newPassword });
        await OtpModel.deleteOne({ email });

        res.json({ success: true, message: "Password updated successfully. You can now log in." });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update new password." });
    }
});

// 6. Post Ad
app.post('/api/items/post', async (req, res) => {
    try { 
        await connectDB();
        const { title, price, category, location, whatsapp, description, imageUrl, sellerEmail, sellerName } = req.body;
        const newItem = new Item({ title, price, category, location, whatsapp, description, imageUrl, sellerEmail, sellerName });
        await newItem.save();
        res.json({ success: true, message: "Advertisement published successfully." });
    } catch (err) { res.status(500).json({ success: false, message: "Failed to post advertisement." }); }
});

// 7. Get Items
app.get('/api/items', async (req, res) => {
    try { 
        await connectDB();
        const { search, category } = req.query;
        let query = {};
        if (category) query.category = category;
        if (search) query.title = { $regex: search, $options: 'i' };
        const items = await Item.find(query).sort({ createdAt: -1 });
        res.json(items);
    } catch (e) { res.status(500).json([]); }
});

// 8. Delete Override (👑 Master Admin Lock)
app.delete('/api/items/:id', async (req, res) => {
    try { 
        await connectDB();
        const { id } = req.params;
        const { email } = req.body;
        const item = await Item.findById(id);
        if (!item) return res.status(404).json({ message: "Item not found." });
        
        if (email === 'ict24067@std.uwu.ac.lk' || item.sellerEmail === email) {
            await Item.findByIdAndDelete(id);
            return res.json({ success: true, message: "Item deleted successfully." });
        }
        res.status(403).json({ message: "Access denied." });
    } catch (e) { res.status(500).json({ message: "Server error." }); }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
