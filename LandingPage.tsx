import React, { useState } from 'react';
import { Shield, Flame, ClipboardCheck, BarChart3, Lock, LogIn, X } from 'lucide-react';

const LandingPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-6 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 p-2 rounded-lg">
            <Flame className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">FireCheck<span className="text-red-600">Pro</span></span>
        </div>
        <button 
          onClick={() => setIsLoginModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-all active:scale-95"
        >
          <LogIn size={18} />
          Acessar Sistema
        </button>
      </nav>

      {/* Hero Section */}
      <header className="relative overflow-hidden pt-16 pb-32 px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(220,38,38,0.05)_0%,rgba(255,255,255,0)_100%)]" />
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wide text-red-600 uppercase bg-red-50 rounded-full border border-red-100">
            Inteligência em Prevenção
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight text-slate-900">
            Inspeção de Incêndio <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">Digital e Automatizada</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Gerencie exigências técnicas, vistorias e conformidade normativa em uma única plataforma tecnológica projetada para engenheiros e inspetores.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="px-8 py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 w-full sm:w-auto"
            >
              Começar agora
            </button>
            <button className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all w-full sm:w-auto">
              Ver Demonstração
            </button>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="py-24 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Shield className="text-red-600" />}
              title="Conformidade Total"
              description="Mapeamento automático de exigências baseado em ocupação, área e altura da edificação."
            />
            <FeatureCard 
              icon={<ClipboardCheck className="text-red-600" />}
              title="Checklists Inteligentes"
              description="Vistorias guiadas por ITs atualizadas, garantindo que nenhum item de segurança seja esquecido."
            />
            <FeatureCard 
              icon={<BarChart3 className="text-red-600" />}
              title="Relatórios em Tempo Real"
              description="Geração instantânea de laudos técnicos e dashboards de conformidade para seus clientes."
            />
          </div>
        </div>
      </section>

      {/* Login Modal Overlay */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsLoginModalOpen(false)} />
          
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-8">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="text-red-600 w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Bem-vindo de volta</h2>
              <p className="text-slate-500">Insira suas credenciais para acessar o painel</p>
            </div>

            <form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
                <input 
                  type="email" 
                  placeholder="nome@empresa.com"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300 text-red-600 focus:ring-red-500" />
                  Lembrar acesso
                </label>
                <a href="#" className="text-red-600 font-semibold hover:underline">Esqueceu a senha?</a>
              </div>
              <button 
                type="submit"
                className="w-full py-3.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-[0.98]"
              >
                Entrar no Sistema
              </button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm">
                Não possui uma conta? <a href="#" className="text-red-600 font-bold hover:underline">Solicite acesso</a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded">
              <Flame className="text-white w-4 h-4" />
            </div>
            <span className="text-white font-bold">FireCheck Pro</span>
          </div>
          <p className="text-sm">© 2024 FireCheck Pro - Sistema de Gestão de Segurança. Todos os direitos reservados.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Termos</a>
            <a href="#" className="hover:text-white transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:border-red-100 hover:bg-red-50/30 transition-all group">
    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3 text-slate-900">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;