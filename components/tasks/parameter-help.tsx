"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { defaultStart, helpText, parameterHelp } from "@/lib/parameterHelp";

const HelpContext = createContext<{ active: string | null; setActive: (id: string | null) => void } | null>(null);

export function ParameterHelpProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  return <HelpContext.Provider value={{ active, setActive }}>
    <Tooltip.Provider delayDuration={400} skipDelayDuration={0}>{children}</Tooltip.Provider>
  </HelpContext.Provider>;
}

export function ParameterHelpLabel({ helpKey, modelId, label, htmlFor, current, initial, children }: {
  helpKey: string;
  modelId?: string;
  label: string;
  htmlFor?: string;
  current?: string;
  initial?: string;
  children?: ReactNode;
}) {
  const { language } = useLanguage();
  const context = useContext(HelpContext);
  const id = useId();
  const tooltipId = useId();
  const touch = useRef(false);
  const returningFocus = useRef(false);
  const [hovered, setHovered] = useState(false);
  const copy = parameterHelp(helpKey, modelId);
  if (!context) throw new Error("ParameterHelpLabel requires ParameterHelpProvider");
  const name = copy ? helpText(copy.title, language) : label;
  if (!copy) return <Label htmlFor={htmlFor}>{label}</Label>;
  const open = context.active === id;
  const tooltipOpen = hovered && !context.active;
  const section = (title: string, text: string) => <section className="space-y-1">
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="text-sm leading-6 text-muted-foreground">{text}</p>
  </section>;

  return <Dialog open={open} onOpenChange={(next) => {
    setHovered(false);
    returningFocus.current = !next;
    context.setActive(next ? id : null);
  }}>
    <Tooltip.Root open={tooltipOpen} onOpenChange={(next) => setHovered(next && !touch.current)}>
      <Tooltip.Trigger asChild>
        <span className="inline-flex max-w-full items-center gap-1 align-middle"
          onPointerEnter={(event) => { touch.current = event.pointerType === "touch"; }}
          onPointerDown={(event) => { touch.current = event.pointerType === "touch"; }}
          onFocus={(event) => {
            if (returningFocus.current) {
              returningFocus.current = false;
              event.preventDefault();
            }
          }}
          onKeyDown={() => { touch.current = false; }}>
          <Label htmlFor={htmlFor} className="min-w-0 leading-5">{name}</Label>
          <DialogTrigger asChild>
            <button type="button" aria-label={`${language === "th" ? "คำอธิบาย" : "About"}: ${name}`}
              aria-describedby={tooltipOpen ? tooltipId : undefined}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </DialogTrigger>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content id={tooltipId} sideOffset={6} collisionPadding={12}
          className="z-50 max-w-[min(22rem,calc(100vw-24px))] rounded-md border bg-popover px-3 py-2 text-sm leading-6 text-popover-foreground shadow-md">
          {helpText(copy.summary, language)}
          <Tooltip.Arrow className="fill-popover" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
    <DialogContent showCloseButton={false} className="left-0 top-auto bottom-0 w-full max-w-none translate-x-0 translate-y-0 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-b-none rounded-t-lg px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
      <DialogClose className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={language === "th" ? "ปิดคำอธิบาย" : "Close help"}>
        <X className="h-4 w-4" aria-hidden="true" />
      </DialogClose>
      <DialogHeader className="pr-9 text-left">
        <DialogTitle className="break-words text-lg leading-7">{name}</DialogTitle>
        <DialogDescription>{helpText(copy.summary, language)}</DialogDescription>
      </DialogHeader>
      {(current !== undefined || initial !== undefined) && <dl className="grid grid-cols-2 gap-3 border-y py-3 text-sm">
        {current !== undefined && <div className="min-w-0"><dt className="text-muted-foreground">{language === "th" ? "ค่าปัจจุบัน" : "Current value"}</dt><dd className="mt-1 break-words font-medium">{current || (language === "th" ? "ยังไม่ระบุ" : "Not set")}</dd></div>}
        {initial !== undefined && <div className="min-w-0"><dt className="text-muted-foreground">{language === "th" ? "ค่าเริ่มต้นของโมเดล" : "Model default"}</dt><dd className="mt-1 break-words font-medium">{initial}</dd></div>}
      </dl>}
      {section(language === "th" ? "ปรับแล้วมีผลอย่างไร" : "What changes", helpText(copy.effect, language))}
      {section(language === "th" ? "ควรเริ่มอย่างไร" : "Where to start", helpText(copy.start ?? defaultStart, language))}
      {copy.caution && section(language === "th" ? "ข้อควรระวัง" : "Watch out for", helpText(copy.caution, language))}
      {children}
    </DialogContent>
  </Dialog>;
}
