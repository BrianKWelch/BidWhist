import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AppContextProvider } from "@/contexts/AppContextProvider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlayerPortalPage from "./pages/PlayerPortalPage";
import BadgeVisitors from "./pages/BadgeVisitors";
import SmsBlastPage from "./pages/SmsBlastPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContextProvider>
          <Toaster />
          <Sonner />
          <HashRouter basename="/">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/portal" element={<PlayerPortalPage />} />
              <Route path="/visitors" element={<BadgeVisitors />} />
              <Route path="/sms" element={<SmsBlastPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </AppContextProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;