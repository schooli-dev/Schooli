-- A phone number can be shared by family members or users using a common contact number.
-- Email and username remain unique login identifiers.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_phone_key;
