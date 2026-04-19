import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FlowProvider } from '@/context/FlowContext';
import BuilderPanel from '@/components/builder/BuilderPanel';
import ChatPlayer from '@/components/player/ChatPlayer';
import { PanelLeft, MessageCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<'builder' | 'player'>('builder');

  return (
    <FlowProvider projectId={projectId}>
      <div className="h-screen flex flex-col bg-background">
        {/* Top bar */}
        <header className="relative z-40 border-b border-border bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <h1 className="text-base font-bold text-foreground tracking-tight">FlowChat</h1>
            <span className="text-xs text-muted-foreground font-medium ml-1">Builder</span>
          </div>

          {/* Mobile tabs */}
          <div className="flex md:hidden gap-1">
            <Button
              variant={activeTab === 'builder' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('builder')}
              className={activeTab === 'builder' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
            >
              <PanelLeft className="w-4 h-4 mr-1" /> Builder
            </Button>
            <Button
              variant={activeTab === 'player' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('player')}
              className={activeTab === 'player' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
            >
              <Play className="w-4 h-4 mr-1" /> Player
            </Button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden relative z-0">
          {/* Builder - desktop always visible, mobile toggled */}
          <div className={`w-full md:w-[420px] lg:w-[480px] border-r border-border shrink-0 overflow-hidden ${activeTab !== 'builder' ? 'hidden md:block' : ''}`}>
            <BuilderPanel />
          </div>

          {/* Player */}
          <div className={`flex-1 overflow-hidden ${activeTab !== 'player' ? 'hidden md:block' : ''}`}>
            <ChatPlayer isPreview={true} />
          </div>
        </div>
      </div>
    </FlowProvider>
  );
};

export default Index;
