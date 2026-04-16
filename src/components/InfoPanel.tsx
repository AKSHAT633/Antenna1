import { motion } from "framer-motion";
import { Info, Signal, Radio } from "lucide-react";

function InfoPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="glass-card rounded-lg p-6 space-y-4"
    >
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Info className="w-5 h-5 text-accent" />
        How it Works
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        The antenna detects dielectric changes in food. Adulteration affects the reflection coefficient and VSWR, enabling non-invasive quality assessment.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-3 p-3 rounded-md bg-success/10">
          <Signal className="w-5 h-5 text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">VSWR &lt; 2</p>
            <p className="text-xs text-muted-foreground">Good impedance matching</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-md bg-success/10">
          <Radio className="w-5 h-5 text-success mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Return Loss &lt; -10 dB</p>
            <p className="text-xs text-muted-foreground">Low reflected energy</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Lower return loss values indicate better power transfer and less reflected energy.
      </p>
    </motion.div>
  );
}

export default InfoPanel;
