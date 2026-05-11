import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from '../services/userService';
import { validateRegistration, validateLogin } from '../middleware/validation';

const router = Router();
const userService = new UserService();

// JWT_SECRET is validated at app startup (index.ts), so it's guaranteed to exist
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
};

router.post('/register', validateRegistration, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userService.create({
      id: uuidv4(),
      email,
      password: hashedPassword,
      name,
    });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', validateLogin, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      getJwtSecret(),
      { expiresIn: '24h' }
    );
    
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;