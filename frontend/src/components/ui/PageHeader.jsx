import React from 'react';
import { motion } from 'framer-motion';

export function PageHeader({ title, subtitle, icon: Icon }) {
    return (
        <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
            <div className="flex items-center gap-4">
                {Icon && (
                    <motion.div
                        className="p-2.5 rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-purple/10 text-accent-blue-light border border-accent-blue/10"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <Icon className="w-6 h-6" />
                    </motion.div>
                )}
                <div>
                    <h2 className="text-2xl font-bold text-gray-50 tracking-tight">{title}</h2>
                    {subtitle && (
                        <motion.p
                            className="text-sm text-gray-500 mt-1"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.4 }}
                        >
                            {subtitle}
                        </motion.p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
