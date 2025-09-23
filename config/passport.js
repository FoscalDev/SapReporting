const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Buscar usuario existente por googleId primero
        let existingUser = await User.findOne({ googleId: profile.id });
        
        if (existingUser) {
            // Actualizar último login
            existingUser.lastLogin = Date.now();
            await existingUser.save();
            return done(null, existingUser);
        }

        // Si no existe por googleId, buscar por email
        existingUser = await User.findOne({ email: profile.emails[0].value });
        
        if (existingUser) {
            // Actualizar googleId si ya existe el email
            existingUser.googleId = profile.id;
            existingUser.name = profile.displayName;
            existingUser.picture = profile.photos[0].value;
            existingUser.lastLogin = Date.now();
            await existingUser.save();
            return done(null, existingUser);
        }

        // Crear nuevo usuario
        const newUser = new User({
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            picture: profile.photos[0].value,
            lastLogin: Date.now()
        });

        await newUser.save();
        return done(null, newUser);
    } catch (error) {
        console.error('Error en estrategia Google OAuth:', error);
        return done(error, null);
    }
}));

// Serializar usuario para la sesión
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserializar usuario de la sesión
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
