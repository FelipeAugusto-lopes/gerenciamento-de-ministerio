import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/store/StoreContext";
import { AuditProvider } from "@/store/AuditContext";
// AuditLog page removed from nav but kept for internal logging
import AppLayout from "@/components/AppLayout";
import Index from "@/pages/Index";
import Schedules from "@/pages/Schedules";
import Members from "@/pages/Members";
import Ministries from "@/pages/Ministries";

import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <StoreProvider>
        <AuditProvider>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/escalas" element={<Schedules />} />
                <Route path="/membros" element={<Members />} />
                <Route path="/ministerios" element={<Ministries />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AuditProvider>
      </StoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
