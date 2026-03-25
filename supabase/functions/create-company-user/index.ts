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
    nome?: string;
    email?: string;
    password?: string;
    role?: "gestor" | "membro";
  };

  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Corpo da requisicao invalido." });
  }

  const companyId = (body.companyId || "").trim();
  const nome = (body.nome || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = (body.password || "").trim();
  const role = body.role === "gestor" ? "gestor" : "membro";

  if (!companyId) {
    return jsonResponse(400, { error: "Empresa nao informada." });
  }

  if (!nome) {
    return jsonResponse(400, { error: "Nome do usuario e obrigatorio." });
  }

  if (!email) {
    return jsonResponse(400, { error: "Email do usuario e obrigatorio." });
  }

  if (password.length < 6) {
    return jsonResponse(400, {
      error: "A senha provisoria precisa ter no minimo 6 caracteres.",
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
    if (role === "gestor") {
      return jsonResponse(403, {
        error: "Somente o administrador geral pode criar um usuario ja como gestor.",
      });
    }

    const { data: gestorMembership, error: membershipError } = await adminClient
      .from("empresa_usuarios")
      .select("id")
      .eq("empresa_id", companyId)
      .eq("user_id", caller.id)
      .eq("papel", "gestor")
      .maybeSingle();

    if (membershipError) {
      return jsonResponse(500, {
        error: "Nao foi possivel validar as permissoes do usuario.",
      });
    }

    if (!gestorMembership) {
      return jsonResponse(403, {
        error: "Apenas o administrador geral ou o gestor da empresa pode criar usuarios.",
      });
    }
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return jsonResponse(500, {
      error: "Nao foi possivel validar se o email ja esta em uso.",
    });
  }

  if (existingProfile) {
    return jsonResponse(409, {
      error: "Ja existe um usuario cadastrado com este e-mail.",
    });
  }

  const { data: createdUserData, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        temporary_password: true,
        created_by_admin_flow: true,
      },
    });

  if (createUserError || !createdUserData.user) {
    return jsonResponse(400, {
      error:
        createUserError?.message ||
        "Nao foi possivel criar a conta de autenticacao do usuario.",
    });
  }

  const createdUser = createdUserData.user;

  if (role === "gestor") {
    const { error: demoteGestorError } = await adminClient
      .from("empresa_usuarios")
      .update({ papel: "membro" })
      .eq("empresa_id", companyId)
      .eq("papel", "gestor")
      .neq("user_id", createdUser.id);

    if (demoteGestorError) {
      return jsonResponse(500, {
        error: "Nao foi possivel ajustar o gestor atual da empresa.",
      });
    }
  }

  const { error: membershipUpsertError } = await adminClient
    .from("empresa_usuarios")
    .upsert(
      {
        empresa_id: companyId,
        user_id: createdUser.id,
        papel: role,
      },
      { onConflict: "empresa_id,user_id" },
    );

  if (membershipUpsertError) {
    return jsonResponse(500, {
      error: "O usuario foi criado, mas nao foi possivel vincula-lo a empresa.",
    });
  }

  return jsonResponse(200, {
    user_id: createdUser.id,
    nome,
    email,
    papel: role,
    temporary_password: true,
  });
});
