-- Add altura_descricao column to empresa table to store the height range description
ALTER TABLE empresa ADD COLUMN IF NOT EXISTS altura_descricao TEXT;