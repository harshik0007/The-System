import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import { config } from './env.js';
import { authService } from '../services/authService.js';

const SESSION_USER_FIELDS = 'username usernameNormalized firstName middleName lastName emailNormalized publicHandle memberSince createdAt accountStatus authMethod authProviders authVersion currentProgressionRunId +googleSub';

export function configurePassport({
  passportInstance = passport,
  UserModel = User,
  service = authService,
  settings = config,
} = {}) {
  passportInstance.serializeUser((user, done) => {
    if (!user?._id) return done(new TypeError('Passport can only serialize a persisted account.'));
    return done(null, String(user._id));
  });

  passportInstance.deserializeUser(async (userId, done) => {
    try {
      const user = await UserModel.findOne({ _id: userId, identityKind: 'account', accountStatus: 'active' })
        .select(SESSION_USER_FIELDS)
        .lean();
      return done(null, user ? { ...user, id: String(user._id) } : false);
    } catch (error) {
      return done(error);
    }
  });

  passportInstance.use('local', new LocalStrategy({
    usernameField: 'identifier',
    passwordField: 'password',
    passReqToCallback: true,
  }, async (request, identifier, password, done) => {
    try {
      const result = await service.login({ identifier, password, ip: request.ip });
      return done(null, result.sessionUser, { authResult: result });
    } catch (error) {
      return done(error);
    }
  }));

  if (settings.googleOAuthEnabled) {
    passportInstance.use('google', new GoogleStrategy({
      clientID: settings.googleClientId,
      clientSecret: settings.googleClientSecret,
      callbackURL: settings.googleCallbackUrl,
      passReqToCallback: true,
      state: true,
    }, async (request, _accessToken, _refreshToken, profile, done) => {
      try {
        const result = await service.googleOAuthSignIn({ profile, ip: request.ip });
        if (result.kind === 'profile-completion-required') {
          return done(null, false, { googlePending: result });
        }
        return done(null, result.sessionUser, { authResult: result });
      } catch (error) {
        return done(error);
      }
    }));

    // Separate strategy for account-deletion re-authentication. It returns a
    // provider profile only and never creates, serializes, or switches an app
    // login session.
    passportInstance.use('google-delete-reauth', new GoogleStrategy({
      clientID: settings.googleClientId,
      clientSecret: settings.googleClientSecret,
      callbackURL: settings.googleCallbackUrl,
      passReqToCallback: true,
      state: true,
    }, (_request, _accessToken, _refreshToken, profile, done) => done(null, profile)));
  }

  return passportInstance;
}

export const passportInstance = configurePassport();
