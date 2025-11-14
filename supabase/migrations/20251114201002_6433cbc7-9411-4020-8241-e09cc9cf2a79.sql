-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can view companies" ON public.empresa;
DROP POLICY IF EXISTS "Anyone can insert companies" ON public.empresa;
DROP POLICY IF EXISTS "Anyone can update companies" ON public.empresa;
DROP POLICY IF EXISTS "Anyone can delete companies" ON public.empresa;

-- Create new policies for authenticated users only
CREATE POLICY "Authenticated users can view companies"
  ON public.empresa
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON public.empresa
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON public.empresa
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete companies"
  ON public.empresa
  FOR DELETE
  TO authenticated
  USING (true);

-- Fix empresa_checklist table as well
DROP POLICY IF EXISTS "Anyone can view company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Anyone can insert company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Anyone can update company checklists" ON public.empresa_checklist;
DROP POLICY IF EXISTS "Anyone can delete company checklists" ON public.empresa_checklist;

CREATE POLICY "Authenticated users can view company checklists"
  ON public.empresa_checklist
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company checklists"
  ON public.empresa_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company checklists"
  ON public.empresa_checklist
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete company checklists"
  ON public.empresa_checklist
  FOR DELETE
  TO authenticated
  USING (true);

-- Fix empresa_exigencias table
DROP POLICY IF EXISTS "Anyone can view company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Anyone can insert company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Anyone can update company requirements" ON public.empresa_exigencias;
DROP POLICY IF EXISTS "Anyone can delete company requirements" ON public.empresa_exigencias;

CREATE POLICY "Authenticated users can view company requirements"
  ON public.empresa_exigencias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert company requirements"
  ON public.empresa_exigencias
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update company requirements"
  ON public.empresa_exigencias
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete company requirements"
  ON public.empresa_exigencias
  FOR DELETE
  TO authenticated
  USING (true);