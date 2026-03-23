import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/store/StoreContext";
import { AuthProvider, useAuth } from "@/store/AuthContext";
import AppLayout from "@/components/AppLayout";
import Schedules from "@/pages/Schedules";
import Members from "@/pages/Members";
import Ministries from "@/pages/Ministries";
import Users from "@/pages/Users";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthGate() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Login />;
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Schedules />} />
        <Route path="/membros" element={<Members />} />
        <Route path="/ministerios" element={<Ministries />} />
        {currentUser.role === "admin" && <Route path="/usuarios" element={<Users />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <StoreProvider>
        <AuthProvider>
          <BrowserRouter>
            <AuthGate />
          </BrowserRouter>
        </AuthProvider>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
