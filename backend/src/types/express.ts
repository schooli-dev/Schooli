export type AuthenticatedUser = {
  id: string;
  username: string | null;
  email: string;
  phone: string | null;
  timezone: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
