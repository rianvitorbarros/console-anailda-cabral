import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface MercadoPagoSettings {
  publicKey: string;
  environment: 'sandbox' | 'production';
  webhookUrl: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  accessTokenMasked: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export const getMercadoPagoSettings = async (projectId: string): Promise<MercadoPagoSettings | null> => {
  try {
    const docRef = doc(db, 'projects', projectId, 'integrations', 'mercadopago');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as MercadoPagoSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching Mercado Pago settings:", error);
    throw error;
  }
};

export const saveMercadoPagoSettings = async (
  projectId: string, 
  settings: Partial<MercadoPagoSettings>,
  accessToken?: string,
  userId?: string
): Promise<void> => {
  try {
    const docRef = doc(db, 'projects', projectId, 'integrations', 'mercadopago');
    const secretsRef = doc(db, 'projects', projectId, 'integration_secrets', 'mercadopago');
    
    const docSnap = await getDoc(docRef);
    
    const dataToSave: any = {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: userId || 'unknown'
    };
    
    if (!docSnap.exists()) {
      dataToSave.createdAt = serverTimestamp();
    }

    if (accessToken) {
       dataToSave.accessTokenMasked = maskToken(accessToken);
       // TODO (Backend): Em produção, o frontend deve enviar o token para uma Cloud Function.
       // A Cloud Function salvaria o token real no Secret Manager ou em um banco isolado.
       // Como ainda não temos backend, estamos salvando o token real em uma coleção separada
       // que deve ter regras de bloqueio de leitura no Firestore.
       const secretDataToSave = removeUndefinedFields({
         accessToken,
         updatedAt: serverTimestamp(),
         updatedBy: userId || 'unknown'
       });
       
       if (!docSnap.exists()) {
          secretDataToSave.createdAt = serverTimestamp();
       }
       
       await setDoc(secretsRef, secretDataToSave, { merge: true });
    }

    const cleanDataToSave = removeUndefinedFields(dataToSave);

    await setDoc(docRef, cleanDataToSave, { merge: true });
  } catch (error) {
    console.error("Error saving Mercado Pago settings:", error);
    throw error;
  }
};

function removeUndefinedFields(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '****';
  const first4 = token.substring(0, 4);
  const last4 = token.substring(token.length - 4);
  return `${first4}...${last4}`;
}
