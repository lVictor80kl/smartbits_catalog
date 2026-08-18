import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useCorteContable() {
  const [corte, setCorte] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'finanzas', 'corte_contable'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().activo) {
        const data = docSnap.data();
        setCorte({
          ...data,
          fecha_corte_js: data.fecha_corte ? data.fecha_corte.toDate() : null
        });
      } else {
        setCorte(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error al cargar corte contable:", err);
      setCorte(null);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { corte, loading, tieneCorte: !!corte?.activo };
}
