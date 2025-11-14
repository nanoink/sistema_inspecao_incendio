import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      nome: '',
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo de volta"
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao fazer login",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.nome);
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Erro ao criar conta",
            description: "Este email já está cadastrado",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Você já está logado e pode começar a usar o sistema"
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao criar sua conta",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLogin ? 'Login' : 'Criar Conta'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? 'Entre com suas credenciais para acessar o sistema' 
              : 'Preencha os dados para criar sua conta'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLogin ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  {...loginForm.register('email')}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••"
                  {...loginForm.register('password')}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline"
                  disabled={isLoading}
                >
                  Não tem uma conta? Cadastre-se
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-nome">Nome</Label>
                <Input
                  id="signup-nome"
                  type="text"
                  placeholder="Seu nome completo"
                  {...signupForm.register('nome')}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.nome && (
                  <p className="text-sm text-destructive">{signupForm.formState.errors.nome.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  {...signupForm.register('email')}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••"
                  {...signupForm.register('password')}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  placeholder="••••••"
                  {...signupForm.register('confirmPassword')}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Conta
              </Button>

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline"
                  disabled={isLoading}
                >
                  Já tem uma conta? Faça login
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
