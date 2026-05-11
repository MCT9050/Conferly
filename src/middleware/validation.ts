import { Request, Response, NextFunction } from 'express';
import { CustomError } from './errorHandler';

export const validateRegistration = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return next(new CustomError('Email, password, and name are required', 400));
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(new CustomError('Invalid email format', 400));
  }
  
  if (password.length < 8) {
    return next(new CustomError('Password must be at least 8 characters', 400));
  }
  
  next();
};

export const validateLogin = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return next(new CustomError('Email and password are required', 400));
  }
  
  next();
};

export const validateCreateRoom = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { name } = req.body;
  
  if (!name || name.trim().length === 0) {
    return next(new CustomError('Room name is required', 400));
  }
  
  if (name.length > 100) {
    return next(new CustomError('Room name must be less than 100 characters', 400));
  }
  
  next();
};

export const validateMessage = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const { content, roomId } = req.body;
  
  if (!content || content.trim().length === 0) {
    return next(new CustomError('Message content is required', 400));
  }
  
  if (!roomId) {
    return next(new CustomError('Room ID is required', 400));
  }
  
  if (content.length > 5000) {
    return next(new CustomError('Message too long (max 5000 characters)', 400));
  }
  
  next();
};