REVOKE ALL ON FUNCTION public.get_equipment_qr_page(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_equipment_qr_non_conformities(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_equipment_qr_non_conformity(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_equipment_qr_page(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_equipment_qr_non_conformities(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_equipment_qr_non_conformity(UUID, UUID, TEXT, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_equipment_qr_page(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_qr_checklist(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_equipment_qr_non_conformities(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_qr_non_conformity(UUID, UUID, TEXT, TEXT) TO authenticated;
