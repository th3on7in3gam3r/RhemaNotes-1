import React from 'react';
import { MindMapNode } from '../types';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RefreshCw, Network, X } from 'lucide-react';

interface MindMapProps { data: MindMapNode; }

const Node: React.FC<{ node: MindMapNode; level: number; isMobile: boolean }> = ({ node, level, isMobile }) => {
  const isRoot = level === 0;
  const isMain = level === 1;

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: level * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
        className={`
          px-3.5 py-2.5 rounded-xl border mb-4 text-center max-w-[180px] break-words shadow-sm
          ${isRoot
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-400 text-white font-black text-xs md:text-sm shadow-glow min-w-[130px] md:min-w-[150px]'
            : isMain
            ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-600 text-slate-900 dark:text-white font-bold text-[10px] md:text-xs shadow-soft min-w-[100px] md:min-w-[120px]'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium text-[9px] md:text-[10px] min-w-[90px] md:min-w-[100px]'
          }
        `}
      >
        {node.label}
      </motion.div>

      {node.children?.length ? (
        isMobile ? (
          <div className="flex flex-col items-center relative pt-3 w-full">
            <div className="absolute top-0 bottom-3 left-1/2 w-px bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
            {node.children.map(child => (
              <div key={child.id} className="relative pt-3 w-full flex flex-col items-center">
                <Node node={child} level={level + 1} isMobile={isMobile} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex space-x-4 md:space-x-6 relative pt-4">
            <div className="absolute top-0 left-1/2 w-px h-4 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
            <div className="absolute top-4 left-[8%] right-[8%] h-px bg-slate-200 dark:bg-slate-700" />
            {node.children.map(child => (
              <div key={child.id} className="relative pt-4">
                <div className="absolute top-0 left-1/2 w-px h-4 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
                <Node node={child} level={level + 1} isMobile={isMobile} />
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
};

export const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [initialScale, setInitialScale] = React.useState(0.55);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setInitialScale(mobile ? 0.35 : 0.55);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* ── Inline Premium Launch Card ── */}
      <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-slate-800/40 dark:to-slate-900/20 rounded-3xl border border-indigo-100/50 dark:border-slate-800 text-center shadow-sm">
        <div className="w-16 h-16 bg-blue-100/60 dark:bg-blue-950/60 rounded-2xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
          <Network className="w-8 h-8" />
        </div>
        <h4 className="text-lg font-serif font-black text-indigo-950 dark:text-white mb-2">Interactive Vision Map</h4>
        <p className="text-sm text-indigo-900/60 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          Praise God! Explore a fully interactive, zoomable, and draggable mental map of the sermon's key themes, scriptures, and spiritual takeaways.
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all text-sm flex items-center space-x-2"
        >
          <Network className="w-4 h-4" />
          <span>Launch Vision Map</span>
        </button>
      </div>

      {/* ── Immersive Modal Portal ── */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 bg-slate-950/50 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl h-[80vh] bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Network className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm md:text-base font-serif font-black text-indigo-950 dark:text-white leading-tight">Interactive Vision Map</h3>
                    <p className="text-[10px] md:text-xs text-indigo-900/40 dark:text-slate-400">Pinch or scroll to zoom, click and drag to pan</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 w-full bg-slate-50 dark:bg-slate-950/40 relative overflow-hidden">
                <TransformWrapper 
                  key={`${isMobile}-${initialScale}`}
                  initialScale={initialScale} 
                  centerOnInit 
                  minScale={0.1} 
                  maxScale={2.0}
                >
                  {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                      {/* Controls */}
                      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-1.5">
                        {[
                          { fn: () => zoomIn(),         Icon: ZoomIn   },
                          { fn: () => zoomOut(),        Icon: ZoomOut  },
                          { fn: () => resetTransform(), Icon: RefreshCw },
                        ].map(({ fn, Icon }, i) => (
                          <button
                            key={i}
                            onClick={fn}
                            className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-soft border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-400 transition-colors"
                          >
                            <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          </button>
                        ))}
                      </div>

                      <TransformComponent wrapperClass="!w-full !h-full">
                        <div className={`${isMobile ? 'p-4' : 'p-6'} flex items-center justify-center min-w-max min-h-max`}>
                          <Node node={data} level={0} isMobile={isMobile} />
                        </div>
                      </TransformComponent>
                    </>
                  )}
                </TransformWrapper>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
