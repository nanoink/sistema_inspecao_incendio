import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SYSTEM_ADMIN_EMAIL = "firetetraedro@gmail.com";

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Metodo nao permitido." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "Configuracao do Supabase incompleta." });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse(401, { error: "Cabecalho de autorizacao ausente." });
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return jsonResponse(401, {
      error: "Nao foi possivel validar o usuario autenticado.",
    });
  }

  const callerEmail = (caller.email || "").trim().toLowerCase();
  const isSystemAdmin = callerEmail === SYSTEM_ADMIN_EMAIL;

  let body: {
    companyId?: string;
    userId?: string;
    nome?: string;
    cpf?: string;
    cargo?: string;
    crea?: string;
    isTechnicalResponsible?: boolean;
    canExecuteChecklists?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Corpo da requisicao invalido." });
  }

  const companyId = (body.companyId || "").trim();
  const userId = (body.userId || "").trim();
  const nome = (body.nome || "").trim();
  const cpf = (body.cpf || "").replace(/\D/g, "").slice(0, 11);
  const cargo = (body.cargo || "").trim();
  const crea = (body.crea || "").trim();
  const isTechnicalResponsible = body.isTechnicalResponsible === true;
  const canExecuteChecklists = body.canExecuteChecklists !== false;

  if (!companyId) {
    return jsonResponse(400, { error: "Empresa nao informada." });
  }

  if (!userId) {
    return jsonResponse(400, { error: "Usuario nao informado." });
  }

  if (!nome) {
    return jsonResponse(400, { error: "Nome do usuario e obrigatorio." });
  }

  if (cpf.length !== 11) {
    return jsonResponse(400, { error: "Informe um CPF valido para o usuario." });
  }

  if (!cargo) {
    return jsonResponse(400, { error: "Cargo do usuario e obrigatorio." });
  }

  if (isTechnicalResponsible && !crea) {
    return jsonResponse(400, {
      error: "O numero do CREA e obrigatorio para o responsavel tecnico.",
    });
  }

  const { data: company, error: companyError } = await adminClient
    .from("empresa")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError) {
    return jsonResponse(500, {
      error: "Nao foi possivel validar a empresa informada.",
    });
  }

  if (!company) {
    return jsonResponse(404, {
      error: "Empresa nao encontrada.",
    });
  }

  if (!isSystemAdmin) {
    const { data: gestorMembership, error: membershipError } = await adminClient
      .from("empresa_usuarios")
      .select("id")
      .eq("empresa_id", companyId)
      .eq("user_id", caller.id)
      .eq("papel", "gestor")
      .maybeSingle();

    if (membershipError) {
      return jsonResponse(500, {
        error: "Nao foi possivel validar as permissoes do usuario autenticado.",
      });
    }

    if (!gestorMembership) {
      return jsonResponse(403, {
        error: "Apenas o administrador geral ou o gestor da empresa pode editar usuarios.",
      });
    }
  }

  const { data: targetMembership, error: targetMembershipError } = await adminClient
    .from("empresa_usuarios")
    .select("papel")
    .eq("empresa_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetMembershipError) {
    return jsonResponse(500, {
      error: "Nao foi possivel localizar o vinculo do usuario com a empresa.",
    });
  }

  if (!targetMembership) {
    return jsonResponse(404, {
      error: "Usuario nao vinculado a esta empresa.",
    });
  }

  const finalCanExecuteChecklists =
    targetMembership.papel === "gestor" ? true : canExecuteChecklists;

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({
      nome,
      cpf: cpf || null,
      cargo: cargo || null,
      crea: crea || null,
    })
    .eq("id", userId);

  if (profileUpdateError) {
    return jsonResponse(500, {
      error: "Nao foi possivel atualizar os dados cadastrais do usuario.",
    });
  }

  if (isTechnicalResponsible) {
    const { error: clearTechnicalResponsibleError } = await adminClient
      .from("empresa_usuarios")
      .update({
        is_responsavel_tecnico: false,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", companyId);

    if (clearTechnicalResponsibleError) {
      return jsonResponse(500, {
        error: "Nao foi possivel atualizar o responsavel tecnico atual da empresa.",
      });
    }
  }

  const { error: membershipUpdateError } = await adminClient
    .from("empresa_usuarios")
    .update({
      is_responsavel_tecnico: isTechnicalResponsible,
      pode_executar_checklists: finalCanExecuteChecklists,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", companyId)
    .eq("user_id", userId);

  if (membershipUpdateError) {
    return jsonResponse(500, {
      error: "Nao foi possivel atualizar as permissoes do usuario na empresa.",
    });
  }

  const { data: updatedProfile, error: updatedProfileError } = await adminClient
    .from("profiles")
    .select("id, email, nome, cpf, cargo, crea")
    .eq("id", userId)
    .maybeSingle();

  if (updatedProfileError || !updatedProfile) {
    return jsonResponse(500, {
      error: "Nao foi possivel confirmar os dados atualizados do usuario.",
    });
  }

  const { data: updatedMembership, error: updatedMembershipError } = await adminClient
    .from("empresa_usuarios")
    .select("papel, is_responsavel_tecnico, pode_executar_checklists, created_at, updated_at")
    .eq("empresa_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (updatedMembershipError || !updatedMembership) {
    return jsonResponse(500, {
      error: "Nao foi possivel confirmar o vinculo atualizado do usuario com a empresa.",
    });
  }

  return jsonResponse(200, {
    user_id: updatedProfile.id,
    nome: updatedProfile.nome || updatedProfile.email || "Usuario sem nome",
    email: updatedProfile.email,
    cpf: updatedProfile.cpf || null,
    cargo: updatedProfile.cargo || null,
    crea: updatedProfile.crea || null,
    papel: updatedMembership.papel,
    is_responsavel_tecnico: updatedMembership.is_responsavel_tecnico === true,
    pode_executar_checklists:
      updatedMembership.papel === "gestor"
        ? true
        : updatedMembership.pode_executar_checklists !== false,
    created_at: updatedMembership.created_at,
    updated_at: updatedMembership.updated_at,
  });
});
