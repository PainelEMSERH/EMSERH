
-- Seeds iniciais
INSERT INTO regional (nome) VALUES
  ('Reg. Norte') ON CONFLICT (nome) DO NOTHING;
INSERT INTO regional (nome) VALUES
  ('Reg. Sul') ON CONFLICT (nome) DO NOTHING;
INSERT INTO regional (nome) VALUES
  ('Reg. Leste') ON CONFLICT (nome) DO NOTHING;
INSERT INTO regional (nome) VALUES
  ('Reg. Centro') ON CONFLICT (nome) DO NOTHING;
