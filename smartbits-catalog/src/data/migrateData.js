import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { mockLaptops } from './mockLaptops';

/**
 * Función para migrar los datos estáticos del mock a la base de datos real de Firestore.
 * Esto permitirá que el usuario vea los equipos en el Admin de inmediato.
 */
export const migrateMockToFirestore = async () => {
  console.log("Iniciando migración de laptops...");
  let count = 0;
  
  try {
    for (const laptop of mockLaptops) {
      // Evitar duplicar el ID numérico si Firestore usa IDs aleatorios, 
      // pero mantenemos los datos técnicos.
      const { id, ...laptopData } = laptop;
      
      await addDoc(collection(db, 'laptops'), {
        ...laptopData,
        creadoEn: serverTimestamp()
      });
      count++;
      console.log(`Migrada: ${laptop.modelo}`);
    }
    
    alert(`¡Migración completada! ${count} equipos subidos a Firestore.`);
    return true;
  } catch (error) {
    console.error("Error en la migración:", error);
    alert("Error en la migración: " + error.message);
    return false;
  }
};
