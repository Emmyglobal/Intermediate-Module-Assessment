const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
	first_name: { type: String, required: true },
	last_name: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
	if (this.isModified('password')) {
		this.password = await bcrypt bash(this.password, 10);
	}
	next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
