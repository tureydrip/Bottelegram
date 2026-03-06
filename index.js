import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, push, remove } from 'firebase/database';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBCk_6-UQu_8js-Rof_Vps7QWPBw6dJFcg",
  authDomain: "temo-store.firebaseapp.com",
  databaseURL: "https://temo-store-default-rtdb.firebaseio.com", 
  projectId: "temo-store",
  storageBucket: "temo-store.firebasestorage.app",
  messagingSenderId: "502364316401",
  appId: "1:502364316401:web:201b9e9c6e426acdb33f50"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. CONFIGURACIÓN DE LOS BOTS ---

// BOT 1: TEMO STORE
const token = '8240591970:AAEAPtTNdanUdR0tXZDjFC9hcdxsdmQFuGI'; 
const bot = new TelegramBot(token, { polling: true });

// BOT 2: TIKTOK GRATIS
const tokenTiktok = '8038521927:AAH32NbJJwzNgZTResVyHi24kVycRhPRt7U';
const botTiktok = new TelegramBot(tokenTiktok, { polling: true });

// Variables globales del Bot 1
const PRINCIPAL_ADMINS = [8182510987, 7710633235, 5706003078];
const WHATSAPP_URL = "https://wa.me/523224528803";
const COSTO_TIKTOK = 0.05; 
const userStates = {};

let botUsername = "";
bot.getMe().then(info => botUsername = info.username);

// --- FUNCIONES DEL SISTEMA DE SESIONES ---

// Obtiene el ID real de la base de datos vinculado a la sesión actual
async function getSessionId(chatId) {
  const snap = await get(ref(db, `sessions/${chatId}`));
  return snap.exists() ? snap.val().realId : null;
}

async function checkAdminPermissions(realId) {
  if (!realId) return { isPrincipal: false, isSubAdmin: false, isAdmin: false, hasPermission: () => false };
  
  const isPrincipal = PRINCIPAL_ADMINS.includes(Number(realId));
  const subAdminsSnap = await get(ref(db, 'sub_admins'));
  const subAdmins = subAdminsSnap.exists() ? subAdminsSnap.val() : {};
  const isSubAdmin = subAdmins.hasOwnProperty(realId.toString());
  
  const isAdmin = isPrincipal || isSubAdmin;
  const permisos = isSubAdmin ? (subAdmins[realId.toString()].permisos || {}) : {};

  const hasPermission = (perm) => {
    if (isPrincipal) return true;
    if (isSubAdmin && permisos[perm] === true) return true;
    return false;
  };

  return { isPrincipal, isSubAdmin, isAdmin, hasPermission };
}

// Genera el menú principal basado en los permisos
async function showMainMenu(chatId, realId, username) {
  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(realId);

  if (isAdmin) {
    const keyboard = [];
    const row1 = [];
    if (hasPermission('add_saldo')) row1.push({ text: "➕ Agregar Saldo" });
    if (hasPermission('remove_saldo')) row1.push({ text: "➖ Quitar Saldo" });
    if (row1.length > 0) keyboard.push(row1);

    const row2 = [];
    if (hasPermission('create_prod')) row2.push({ text: "📦 Crear Producto" });
    if (hasPermission('manage_prod')) row2.push({ text: "📋 Gestionar Productos" });
    if (row2.length > 0) keyboard.push(row2);

    const row3 = [];
    if (hasPermission('view_stock')) row3.push({ text: "📊 Ver Stocks" });
    if (hasPermission('edit_price')) row3.push({ text: "✏️ Editar Precios" });
    if (row3.length > 0) keyboard.push(row3);

    const row4 = [];
    if (hasPermission('view_history')) row4.push({ text: "📜 Historial Compras" });
    if (row4.length > 0) keyboard.push(row4);

    keyboard.push([{ text: "👤 Mi Perfil" }, { text: "📱 Descargar TikTok" }]);
    if (isPrincipal) keyboard.push([{ text: "👥 Gestionar Admins" }]);

    bot.sendMessage(chatId, `👑 *Panel de Administrador* | Sesión activa`, {
      parse_mode: "Markdown",
      reply_markup: { keyboard: keyboard, resize_keyboard: true, is_persistent: true }
    });
  } else {
    bot.sendMessage(chatId, `👋 Sesión iniciada correctamente.\n¡Bienvenido a *TEMO STORE*!\n\nUsa el menú de abajo para navegar:`, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "🛒 Ver Productos" }], 
          [{ text: "👤 Mi Perfil" }, { text: "💳 Recargar Saldo" }],
          [{ text: "📱 Descargar TikTok" }]
        ],
        resize_keyboard: true, is_persistent: true
      }
    });
  }
}

async function getTikTokVideo(url) {
  try {
    const response = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: url, hd: 1 })
    });
    const data = await response.json();
    if (data.code === 0 && data.data) { return data.data.hdplay || data.data.play; }
    return null;
  } catch (error) { return null; }
}

async function getAndTrackTiktokUsers(chatId) {
  const userRef = ref(db, `tiktok_bot_users/${chatId}`);
  const userSnap = await get(userRef);
  const statsRef = ref(db, `tiktok_bot_stats/total_users`);
  let totalUsers = 0;
  const statsSnap = await get(statsRef);
  if (statsSnap.exists()) totalUsers = statsSnap.val();
  if (!userSnap.exists()) {
    totalUsers += 1;
    await set(userRef, true);
    await set(statsRef, totalUsers);
  }
  return totalUsers;
}

// ==========================================
// ====== LÓGICA DEL BOT 2 (TIKTOK GRATIS) ==
// ==========================================

botTiktok.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const totalUsuarios = await getAndTrackTiktokUsers(chatId);
  const mensaje = "🤖 *Este bot está 100% programado por sebastian (LUCK XIT OFC)*\n\n👋 ¡Hola! Soy un bot totalmente gratuito para descargar videos de TikTok.\n\n`📊 *Usuarios totales que me usan:* ${totalUsuarios}\n\n📖 *¿Cómo usar el bot?*\nSimplemente cópiame y envíame un enlace válido de TikTok (ejemplo: `https://vm.tiktok.com/...`) y yo me encargaré de enviarte el video sin marca de agua al instante. 🚀";
  botTiktok.sendMessage(chatId, mensaje, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "📞 Contacto en WhatsApp", url: "https://wa.me/573142369516" }]] } });
});

botTiktok.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  const totalUsuarios = await getAndTrackTiktokUsers(chatId);

  if (text.includes('tiktok.com')) {
    const waitMsg = await botTiktok.sendMessage(chatId, "⏳ Descargando video sin marca de agua, por favor espera...");
    const videoUrl = await getTikTokVideo(text.trim());
    if (videoUrl) {
      try {
        await botTiktok.sendVideo(chatId, videoUrl, { caption: `✅ ¡Aquí tienes tu video gratis!\n\n📊 *Usuarios totales en tiempo real:* ${totalUsuarios}\n🤖 _Bot by: sebastian (LUCK XIT OFC)_`, parse_mode: "Markdown" });
        botTiktok.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
      } catch (error) {
        botTiktok.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
        botTiktok.sendMessage(chatId, "❌ Error al enviar el video. Puede que sea demasiado pesado para Telegram.");
      }
    } else {
      botTiktok.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
      botTiktok.sendMessage(chatId, "❌ Error al procesar el enlace.");
    }
  } else { botTiktok.sendMessage(chatId, "⚠️ Por favor, envíame un enlace válido de TikTok."); }
});

// ==========================================
// ====== LÓGICA DEL BOT 1 (TEMO STORE) =====
// ==========================================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const refId = match[1]; 
  const realId = await getSessionId(chatId);

  if (realId) {
    // Si ya tienen sesión iniciada, mostramos el menú de una vez
    return showMainMenu(chatId, realId, msg.from.first_name);
  } else {
    // Verificamos si es una cuenta antigua que necesita migración
    const legacySnap = await get(ref(db, `users/${chatId}`));
    if (legacySnap.exists() && !legacySnap.val().username_login) {
      bot.sendMessage(chatId, "⚠️ *Actualización de Seguridad Obligatoria*\n\nHemos mejorado nuestro sistema. Para proteger tus compras y tu saldo, debes crear un Usuario y Contraseña para tu cuenta. Esto reemplaza el sistema de ID antiguo.", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "📝 Reclamar mi cuenta", callback_data: "legacy_register" }]] }
      });
    } else {
      // Usuario totalmente nuevo o alguien que cerró sesión
      if (refId) userStates[chatId] = { pendingRef: refId }; 
      bot.sendMessage(chatId, "👋 Bienvenido a *TEMO STORE*.\n\nPara poder usar los servicios, necesitas tener una cuenta en nuestro sistema. Selecciona una opción:", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔐 Iniciar Sesión", callback_data: "login_account" }],
            [{ text: "📝 Registrarse", callback_data: "new_register" }]
          ]
        }
      });
    }
  }
});

// --- EL "PORTERO" (GATEKEEPER) DE MENSAJES ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  const realId = await getSessionId(chatId);
  const state = userStates[chatId];
  const currentState = state ? { ...state } : null;

  // 1. LÓGICA DE REGISTRO / LOGIN (Puede pasar sin sesión)
  if (currentState) {
    delete userStates[chatId]; 

    // CREACIÓN DE USUARIO
    if (currentState.step === 'AWAITING_NEW_USERNAME') {
      const userStr = text.trim().toLowerCase();
      if (userStr.includes(" ")) {
        userStates[chatId] = currentState;
        return bot.sendMessage(chatId, "❌ El usuario no debe contener espacios. Escribe otro:");
      }
      const userExist = await get(ref(db, `logins/${userStr}`));
      if (userExist.exists()) {
        userStates[chatId] = currentState;
        return bot.sendMessage(chatId, "❌ Ese nombre de usuario ya está ocupado. Intenta con otro:");
      }
      userStates[chatId] = { step: 'AWAITING_NEW_PASSWORD', username: userStr, isLegacy: currentState.isLegacy, pendingRef: currentState.pendingRef };
      return bot.sendMessage(chatId, `✅ Usuario *${userStr}* disponible.\n\n🔑 Ahora, escribe una **Contraseña** segura:`, {parse_mode:"Markdown"});
    }
    
    // CREACIÓN DE CONTRASEÑA
    else if (currentState.step === 'AWAITING_NEW_PASSWORD') {
      const passStr = text.trim();
      const newRealId = chatId; // Anclamos la cuenta nueva a su chat id original bajo el capó

      if (currentState.isLegacy) {
        await update(ref(db, `users/${newRealId}`), { username_login: currentState.username });
      } else {
        await set(ref(db, `users/${newRealId}`), { 
          nombre: msg.from.first_name || "Usuario", saldo: 0, keys_compradas: [], invitados: 0, tiktok_credits: 0,
          username_login: currentState.username 
        });
        
        // Manejo de referidos para cuentas nuevas
        if (currentState.pendingRef && currentState.pendingRef != newRealId) {
          const inviterRef = ref(db, `users/${currentState.pendingRef}`);
          const inviterSnap = await get(inviterRef);
          if (inviterSnap.exists()) {
            let invData = inviterSnap.val();
            let nuevosInv = (invData.invitados || 0) + 1;
            let nuevosCreds = invData.tiktok_credits || 0;
            if (nuevosInv % 5 === 0) {
              nuevosCreds += 2;
              bot.sendMessage(currentState.pendingRef, `🎉 *¡Felicidades!*\nLlegaste a ${nuevosInv} invitados y ganaste **2 Créditos** para TikTok.`, { parse_mode: "Markdown" });
            } else { bot.sendMessage(currentState.pendingRef, `👤 Un nuevo usuario se registró con tu enlace.`); }
            await update(inviterRef, { invitados: nuevosInv, tiktok_credits: nuevosCreds });
          }
        }
      }

      await set(ref(db, `logins/${currentState.username}`), { realId: newRealId, password: passStr });
      await set(ref(db, `sessions/${chatId}`), { realId: newRealId }); // Inicia sesión auto
      
      bot.sendMessage(chatId, "✅ **¡Cuenta creada con éxito y sesión iniciada!**\nYa no dependes de Telegram para guardar tu saldo.", {parse_mode:"Markdown"});
      return showMainMenu(chatId, newRealId, msg.from.first_name);
    }

    // INICIO DE SESIÓN
    else if (currentState.step === 'AWAITING_LOGIN_USERNAME') {
      const userStr = text.trim().toLowerCase();
      const loginSnap = await get(ref(db, `logins/${userStr}`));
      if (!loginSnap.exists()) return bot.sendMessage(chatId, "❌ Usuario no encontrado. Toca Iniciar Sesión de nuevo si te equivocaste.");
      
      userStates[chatId] = { step: 'AWAITING_LOGIN_PASSWORD', targetRealId: loginSnap.val().realId, correctPass: loginSnap.val().password };
      return bot.sendMessage(chatId, "🔑 Ahora, escribe tu **Contraseña**:");
    }
    
    else if (currentState.step === 'AWAITING_LOGIN_PASSWORD') {
      if (text.trim() === currentState.correctPass) {
        await set(ref(db, `sessions/${chatId}`), { realId: currentState.targetRealId });
        bot.sendMessage(chatId, "✅ **¡Sesión Iniciada Correctamente!**\nCargando tus datos...", {parse_mode:"Markdown"});
        return showMainMenu(chatId, currentState.targetRealId, msg.from.first_name);
      } else {
        return bot.sendMessage(chatId, "❌ Contraseña incorrecta. Envía /start para reintentar.");
      }
    }

    // --- ESTADOS ADMINISTRATIVOS CON USUARIOS (En vez de IDs) ---
    else if (currentState.step === 'AWAITING_NEW_ADMIN_USER') {
      const userStr = text.trim().toLowerCase();
      const loginSnap = await get(ref(db, `logins/${userStr}`));
      if (!loginSnap.exists()) return bot.sendMessage(chatId, "❌ El usuario no existe en la base de datos.");
      const newAdminRealId = loginSnap.val().realId;
      await set(ref(db, `sub_admins/${newAdminRealId}`), { agregado_por: realId, permisos: { add_saldo: false, remove_saldo: false, create_prod: false, manage_prod: false, view_stock: false, edit_price: false, view_history: false } });
      return bot.sendMessage(chatId, `✅ Sub-Admin \`${userStr}\` agregado exitosamente.\n\n⚠️ Por defecto tiene todas las funciones desactivadas. Usa "🎛️ Configurar Permisos" para activarle lo que necesites.`, { parse_mode: "Markdown" });
    }
    
    else if (currentState.step === 'AWAITING_USER_ID') { // Cambiado lógicamente a USERNAME
      const targetUserStr = text.trim().toLowerCase();
      const loginSnap = await get(ref(db, `logins/${targetUserStr}`));
      if (!loginSnap.exists()) return bot.sendMessage(chatId, "❌ Usuario no encontrado.");
      const targetRealId = loginSnap.val().realId;
      const userSnapshot = await get(ref(db, `users/${targetRealId}`));
      userStates[chatId] = { step: 'AWAITING_AMOUNT', targetRealId }; 
      return bot.sendMessage(chatId, `Usuario confirmado: *${targetUserStr}*.\n¿Cuánto saldo agregas?`, { parse_mode:"Markdown" });
    } 
    
    else if (currentState.step === 'AWAITING_AMOUNT') {
      const amount = parseFloat(text.trim());
      if (isNaN(amount)) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Escribe un número válido."); }
      const targetRef = ref(db, `users/${currentState.targetRealId}/saldo`);
      const currentBalance = (await get(targetRef)).val() || 0;
      await set(targetRef, currentBalance + amount);
      bot.sendMessage(chatId, `✅ Saldo actualizado. Nuevo saldo: $${currentBalance + amount}`);
      // Notificar a todas las sesiones activas de ese usuario
      const sessionsSnap = await get(ref(db, 'sessions'));
      if(sessionsSnap.exists()) {
         sessionsSnap.forEach(s => { if(s.val().realId === currentState.targetRealId) bot.sendMessage(s.key, `🎉 ¡Te han recargado $${amount} de saldo!`).catch(()=>{}); });
      }
      return;
    }
    
    else if (currentState.step === 'AWAITING_REMOVE_USER_ID') { // Cambiado a USERNAME
      const targetUserStr = text.trim().toLowerCase();
      const loginSnap = await get(ref(db, `logins/${targetUserStr}`));
      if (!loginSnap.exists()) return bot.sendMessage(chatId, "❌ Usuario no encontrado.");
      const targetRealId = loginSnap.val().realId;
      const userSnapshot = await get(ref(db, `users/${targetRealId}`));
      const userData = userSnapshot.val();
      if (userData.saldo <= 0) return bot.sendMessage(chatId, "❌ Este usuario ya tiene $0 de saldo.");
      userStates[chatId] = { step: 'AWAITING_REMOVE_AMOUNT', targetRealId }; 
      return bot.sendMessage(chatId, `Usuario: *${targetUserStr}* (Saldo: $${userData.saldo}).\n¿Cuánto le deseas quitar?`, { parse_mode:"Markdown" });
    }
    
    else if (currentState.step === 'AWAITING_REMOVE_AMOUNT') {
      const amount = parseFloat(text.trim());
      if (isNaN(amount) || amount <= 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Número inválido."); }
      const targetRef = ref(db, `users/${currentState.targetRealId}/saldo`);
      const currentBalance = (await get(targetRef)).val() || 0;
      let nuevoSaldo = currentBalance - amount;
      if (nuevoSaldo < 0) nuevoSaldo = 0;
      await set(targetRef, nuevoSaldo);
      bot.sendMessage(chatId, `✅ Saldo descontado. Nuevo saldo: $${nuevoSaldo}`);
      return;
    }

    else if (currentState.step === 'AWAITING_HISTORY_ID') { // Búsqueda por USERNAME
      const targetUserStr = text.trim().toLowerCase();
      const loginSnap = await get(ref(db, `logins/${targetUserStr}`));
      if (!loginSnap.exists()) return bot.sendMessage(chatId, "❌ Usuario no encontrado en la base de datos.");
      const targetRealId = loginSnap.val().realId;
      const uSnap = await get(ref(db, `users/${targetRealId}`));
      const u = uSnap.val();
      
      let textoHistorial = `📜 *Historial de Compras*\n🧑‍💻 *Usuario:* \`${targetUserStr}\`\n\n`;
      let keysArr = u.keys_compradas || [];
      if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);
      
      if (keysArr.length === 0) { textoHistorial += "Este usuario no ha realizado ninguna compra."; } 
      else {
        keysArr.forEach(k => {
          if (typeof k === 'object') textoHistorial += `🔹 *Producto:* ${k.producto}\n🔑 *Key:* \`${k.key}\`\n💸 *Gasto:* $${k.gasto}\n📅 *Fecha:* ${k.fecha}\n\n`;
          else textoHistorial += `🔹 *Key (Antigua):* \`${k}\`\n\n`;
        });
      }
      return bot.sendMessage(chatId, textoHistorial, { parse_mode: "Markdown" });
    }

    // --- ESTADOS DE PRODUCTOS Y TIKTOK ---
    else if (currentState.step === 'AWAITING_TIKTOK_URL') {
      const url = text.trim();
      if (!url.includes('tiktok.com')) return bot.sendMessage(chatId, "❌ Enlace inválido. Debes enviar un enlace de TikTok.");
      const waitMsg = await bot.sendMessage(chatId, "⏳ Descargando video sin marca de agua...");
      const videoUrl = await getTikTokVideo(url);
      if (videoUrl) {
        try {
          await bot.sendVideo(chatId, videoUrl, { caption: "✅ ¡Aquí tienes tu video sin marca de agua!" });
          bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
          const { isAdmin } = await checkAdminPermissions(realId);
          if (!isAdmin) {
            const userRef = ref(db, `users/${realId}`);
            const userData = (await get(userRef)).val();
            if (currentState.useCredit) {
              await update(userRef, { tiktok_credits: userData.tiktok_credits - 1 });
              bot.sendMessage(chatId, "🎫 Se descontó 1 crédito de tu cuenta.");
            } else if (currentState.cost > 0) {
              await update(userRef, { saldo: userData.saldo - currentState.cost });
              bot.sendMessage(chatId, `💸 Se descontaron $${currentState.cost} de tu saldo.`);
            }
          }
        } catch (error) { bot.sendMessage(chatId, "❌ Error al enviar el video. Demasiado pesado."); }
      } else { bot.sendMessage(chatId, "❌ Error al procesar el enlace. Asegúrate de que sea público."); }
      return;
    }
    
    else if (currentState.step === 'AWAITING_PROD_NAME') {
      const newProdRef = push(ref(db, 'productos'));
      await set(newProdRef, { nombre: text.trim() });
      return bot.sendMessage(chatId, `✅ Producto "${text}" creado.`);
    }
    else if (currentState.step === 'AWAITING_OPT_NAME') {
      const match = text.match(/(.+?)\s+(\d+)\$$/); 
      if (!match) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "⚠️ Formato: '1 dia 3$'. Intenta de nuevo."); }
      const newOptRef = push(ref(db, `productos/${currentState.prodId}/opciones`));
      await set(newOptRef, { titulo: match[1].trim(), precio: parseInt(match[2]), keys: [] });
      return bot.sendMessage(chatId, `✅ Opción agregada.\n¿Agregar keys ahora?`, { reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Keys", callback_data: `add_keys:${currentState.prodId}:${newOptRef.key}` }]] } });
    }
    else if (currentState.step === 'AWAITING_KEYS') {
      const keysArray = text.split('\n').map(k => k.trim()).filter(k => k !== '');
      const keysRef = ref(db, `productos/${currentState.prodId}/opciones/${currentState.optId}/keys`);
      let currentKeys = (await get(keysRef)).val() || [];
      if (!Array.isArray(currentKeys)) currentKeys = Object.values(currentKeys);
      await set(keysRef, currentKeys.concat(keysArray));
      return bot.sendMessage(chatId, `✅ Se agregaron ${keysArray.length} keys.`);
    }
    else if (currentState.step === 'AWAITING_NEW_PRICE') {
      const nuevoPrecio = parseInt(text.trim());
      if (isNaN(nuevoPrecio) || nuevoPrecio < 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Precio inválido."); }
      await update(ref(db), { [`productos/${currentState.prodId}/opciones/${currentState.optId}/precio`]: nuevoPrecio });
      return bot.sendMessage(chatId, `✅ Precio actualizado a $${nuevoPrecio}.`);
    }
  }

  // 2. PROTECCIÓN: Si no hay sesión, rechazar comandos sueltos
  if (!realId) {
    return bot.sendMessage(chatId, "⚠️ *No has iniciado sesión.*\nPara usar la tienda o los menús, envía /start", {parse_mode: "Markdown", reply_markup: {remove_keyboard: true}});
  }

  // 3. --- LÓGICA AUTENTICADA ---
  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(realId);

  if (text === "👤 Mi Perfil") {
    const userData = (await get(ref(db, `users/${realId}`))).val() || { saldo: 0, invitados: 0, tiktok_credits: 0 };
    const linkReferido = `https://t.me/${botUsername}?start=${realId}`; // Referidos siguen funcionando con el realId bajo el capó

    let texto = `👤 *Tu Perfil*\n\n`;
    texto += `🧑‍💻 Usuario: *${userData.username_login || "Admin / Migrado"}*\n`;
    texto += `💰 Saldo: $${userData.saldo}\n\n`;
    texto += `📱 *TikTok Downloader:*\n- Créditos disponibles: ${userData.tiktok_credits}\n- Personas invitadas: ${userData.invitados}\n\n`;
    texto += `🔗 *Tu link de referidos:*\n\`${linkReferido}\`\n\n`;
    texto += `🔑 *Tus Keys Compradas:*\n`;
    
    let keysArr = userData.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);
    if (keysArr.length > 0) {
      keysArr.forEach(k => {
        if (typeof k === 'object') texto += `- \`${k.key}\` (Gastaste: $${k.gasto})\n`;
        else texto += `- \`${k}\`\n`; 
      });
    } else { texto += "Aún no tienes keys."; }
    
    return bot.sendMessage(chatId, texto, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: "🚪 Cerrar Sesión", callback_data: "logout_account" }]] } });
  }

  if (text === "💳 Recargar Saldo") {
    return bot.sendMessage(chatId, `Para recargar saldo, comunícate a nuestro WhatsApp:\n👉 [Contactar por WhatsApp](${WHATSAPP_URL})`, { parse_mode: "Markdown" });
  }

  if (text === "🛒 Ver Productos" && !isAdmin) { 
    const prodsSnap = await get(ref(db, 'productos'));
    if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos disponibles.");
    const botones = [];
    prodsSnap.forEach((child) => { botones.push([{ text: `🎮 ${child.val().nombre || "Producto"}`, callback_data: `buy_prod:${child.key}` }]); });
    return bot.sendMessage(chatId, "Selecciona un producto:", { reply_markup: { inline_keyboard: botones } });
  }

  if (text === "📱 Descargar TikTok") {
    if (isAdmin) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: 0, useCredit: false };
      return bot.sendMessage(chatId, "👑 *Modo Admin:* Envía el enlace de TikTok (Gratis):", { parse_mode: "Markdown" });
    }
    const userData = (await get(ref(db, `users/${realId}`))).val() || { saldo: 0, tiktok_credits: 0 };
    if (userData.tiktok_credits > 0) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: 0, useCredit: true };
      return bot.sendMessage(chatId, `Tienes **${userData.tiktok_credits} créditos**.\nEnvía el enlace:`, { parse_mode: "Markdown" });
    } else if (userData.saldo >= COSTO_TIKTOK) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: COSTO_TIKTOK, useCredit: false };
      return bot.sendMessage(chatId, `Costo: **$${COSTO_TIKTOK}** descontados de tu saldo.\nEnvía el enlace:`, { parse_mode: "Markdown" });
    } else {
      return bot.sendMessage(chatId, `❌ *No tienes saldo ni créditos.*\nConsigue 2 gratis invitando a 5 amigos.`, { parse_mode: "Markdown" });
    }
  }

  // PANEL ADMIN (Usando usernames)
  if (isAdmin) {
    if (text === "👥 Gestionar Admins" && isPrincipal) {
      return bot.sendMessage(chatId, "⚙️ *Gestión de Administradores*\n¿Qué deseas hacer?", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Admin", callback_data: "admin_add" }, { text: "➖ Quitar Admin", callback_data: "admin_remove" }], [{ text: "🎛️ Configurar Permisos", callback_data: "admin_perms" }]] } });
    }
    if (text === "➕ Agregar Saldo") {
      if (!hasPermission('add_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      userStates[chatId] = { step: 'AWAITING_USER_ID' }; // En realidad pide username
      return bot.sendMessage(chatId, "Envía el **Nombre de Usuario** al que deseas recargarle saldo:", { parse_mode: "Markdown" });
    }
    if (text === "➖ Quitar Saldo") {
      if (!hasPermission('remove_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const usersSnap = await get(ref(db, 'users'));
      if (!usersSnap.exists()) return bot.sendMessage(chatId, "No hay usuarios registrados.");
      let lista = "👥 *Usuarios con saldo:*\n\n", hay = false;
      usersSnap.forEach((child) => { 
        const user = child.val(); 
        if (user.saldo > 0 && user.username_login) { 
          lista += `👤 *${user.nombre}*\n🧑‍💻 Usuario: \`${user.username_login}\`\n💰 Saldo: $${user.saldo}\n\n`; hay = true; 
        } 
      });
      if (!hay) return bot.sendMessage(chatId, "❌ Nadie tiene saldo.");
      lista += "Para quitar saldo, envía el **Nombre de Usuario**:";
      userStates[chatId] = { step: 'AWAITING_REMOVE_USER_ID' };
      return bot.sendMessage(chatId, lista, { parse_mode: "Markdown" });
    }
    if (text === "📦 Crear Producto") {
      if (!hasPermission('create_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      userStates[chatId] = { step: 'AWAITING_PROD_NAME' };
      return bot.sendMessage(chatId, "Escribe el **Nombre del producto**:", { parse_mode: "Markdown" });
    }
    if (text === "📋 Gestionar Productos") {
      if (!hasPermission('manage_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
      const botones = [];
      prodsSnap.forEach((child) => { botones.push([{ text: `Editar/Eliminar ${child.val().nombre || "Producto"}`, callback_data: `edit_prod:${child.key}` }]); });
      return bot.sendMessage(chatId, "Selecciona un producto:", { reply_markup: { inline_keyboard: botones } });
    }
    if (text === "📊 Ver Stocks") {
      if (!hasPermission('view_stock')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const prodsSnap = await get(ref(db, 'productos'));
      let mensaje = "📊 *Inventario Actual:*\n\n";
      prodsSnap.forEach((child) => {
        const prod = child.val();
        mensaje += `📦 *${prod.nombre}*\n`;
        if (prod.opciones) {
          for (const optId in prod.opciones) {
            let stock = prod.opciones[optId].keys ? (Array.isArray(prod.opciones[optId].keys) ? prod.opciones[optId].keys.length : Object.keys(prod.opciones[optId].keys).length) : 0;
            mensaje += `  ├ ${prod.opciones[optId].titulo}: *${stock}* disponibles\n`;
          }
        } else { mensaje += `  └ Sin opciones.\n`; }
        mensaje += "\n";
      });
      return bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
    }
    if (text === "✏️ Editar Precios") {
      if (!hasPermission('edit_price')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const prodsSnap = await get(ref(db, 'productos'));
      const botones = [];
      prodsSnap.forEach((child) => { botones.push([{ text: `✏️ Editar precios de ${child.val().nombre || "Producto"}`, callback_data: `edit_price_prod:${child.key}` }]); });
      return bot.sendMessage(chatId, "Selecciona el producto:", { reply_markup: { inline_keyboard: botones } });
    }
    if (text === "📜 Historial Compras") {
      if (!hasPermission('view_history')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      return bot.sendMessage(chatId, "📜 *Gestión de Historial*\nElige una opción:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "👥 Ver todos", callback_data: "hist_all" }], [{ text: "🔍 Buscar por Usuario", callback_data: "hist_search" }]] }
      });
    }
  }
});

// --- 5. MANEJO DE BOTONES EN LÍNEA ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const responder = () => bot.answerCallbackQuery(query.id).catch(()=>{});
  
  // LOGIN Y REGISTRO
  if (data === "legacy_register" || data === "new_register") {
    userStates[chatId] = { step: 'AWAITING_NEW_USERNAME', isLegacy: data === "legacy_register", pendingRef: userStates[chatId]?.pendingRef };
    bot.sendMessage(chatId, "✏️ Escribe un **Nombre de Usuario** único (sin espacios):", {parse_mode: "Markdown"});
    return responder();
  }
  if (data === "login_account") {
    userStates[chatId] = { step: 'AWAITING_LOGIN_USERNAME' };
    bot.sendMessage(chatId, "🔄 Escribe tu **Nombre de Usuario**:");
    return responder();
  }
  if (data === "logout_account") {
    await remove(ref(db, `sessions/${chatId}`));
    bot.sendMessage(chatId, "🚪 **Sesión cerrada exitosamente.**\n\n_Para volver a entrar, envía /start_", {parse_mode: "Markdown", reply_markup: {remove_keyboard: true}});
    return responder();
  }

  // BARRERA DE AUTENTICACIÓN PARA BOTONES INLINE
  const realId = await getSessionId(chatId);
  if (!realId) {
    bot.sendMessage(chatId, "⚠️ La sesión expiró. Envía /start");
    return responder();
  }

  const { isAdmin, isPrincipal } = await checkAdminPermissions(realId);

  // HISTORIAL GLOBAL
  if (data === "hist_all" && isAdmin) {
    const usersSnap = await get(ref(db, 'users'));
    let botones = [];
    usersSnap.forEach((child) => {
      const u = child.val();
      if (u.username_login && u.keys_compradas && (Array.isArray(u.keys_compradas) ? u.keys_compradas.length > 0 : Object.keys(u.keys_compradas).length > 0)) {
        botones.push([{ text: `🧑‍💻 ${u.username_login}`, callback_data: `view_hist:${child.key}` }]);
      }
    });
    if (botones.length === 0) { bot.sendMessage(chatId, "Aún no hay compras registradas."); return responder(); }
    bot.sendMessage(chatId, "Selecciona un usuario para ver su historial:", { reply_markup: { inline_keyboard: botones } });
    return responder();
  }

  if (data === "hist_search" && isAdmin) {
    userStates[chatId] = { step: 'AWAITING_HISTORY_ID' }; // Busca username
    bot.sendMessage(chatId, "🔍 Envía el **Nombre de Usuario** para buscar su historial exacto:", { parse_mode: "Markdown" });
    return responder();
  }

  if (data.startsWith('view_hist:') && isAdmin) {
    const targetRealId = data.split(':')[1];
    const uSnap = await get(ref(db, `users/${targetRealId}`));
    const u = uSnap.val();
    let textoHistorial = `📜 *Historial de Compras*\n🧑‍💻 *Usuario:* \`${u.username_login || "Migrado"}\`\n\n`;
    let keysArr = u.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);
    
    if (keysArr.length === 0) textoHistorial += "Este usuario no tiene compras.";
    else {
      keysArr.forEach(k => {
        if (typeof k === 'object') textoHistorial += `🔹 *Producto:* ${k.producto}\n🔑 *Key:* \`${k.key}\`\n💸 *Gasto:* $${k.gasto}\n📅 *Fecha:* ${k.fecha}\n\n`;
        else textoHistorial += `🔹 *Key (Antigua):* \`${k}\`\n\n`;
      });
    }
    bot.sendMessage(chatId, textoHistorial, { parse_mode: "Markdown" });
    return responder();
  }

  // TIENDA
  if (data.startsWith('buy_prod:')) {
    const prodId = data.split(':')[1];
    const producto = (await get(ref(db, `productos/${prodId}`))).val();
    if (!producto || !producto.opciones) { bot.sendMessage(chatId, "Producto sin duraciones."); return responder(); }
    const botones = [];
    for (const optId in producto.opciones) botones.push([{ text: `${producto.opciones[optId].titulo} - $${producto.opciones[optId].precio}`, callback_data: `checkout:${prodId}:${optId}` }]);
    bot.sendMessage(chatId, `🛒 *${producto.nombre}*\nElige la duración:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: botones } });
    return responder();
  }

  if (data.startsWith('checkout:')) {
    const [, prodId, optId] = data.split(':');
    const [userSnap, optSnap, prodNameSnap] = await Promise.all([ get(ref(db, `users/${realId}`)), get(ref(db, `productos/${prodId}/opciones/${optId}`)), get(ref(db, `productos/${prodId}/nombre`)) ]);

    const user = userSnap.val() || { saldo: 0 };
    const opt = optSnap.val() || {};
    let keysDisp = opt.keys || [];
    if (!Array.isArray(keysDisp)) keysDisp = Object.values(keysDisp);

    if (keysDisp.length === 0) { bot.sendMessage(chatId, "❌ No hay keys disponibles."); return responder(); }
    if (user.saldo < opt.precio) { bot.sendMessage(chatId, `❌ *Saldo insuficiente.*\nTu saldo: $${user.saldo}\nPrecio: $${opt.precio}`, { parse_mode: "Markdown" }); return responder(); }

    const keyEntregada = keysDisp[0];
    const nuevoSaldo = user.saldo - opt.precio; 
    let keysUser = user.keys_compradas || [];
    if (!Array.isArray(keysUser)) keysUser = Object.values(keysUser);
    
    const nuevaCompra = { key: keyEntregada, producto: `${prodNameSnap.exists() ? prodNameSnap.val() : "Producto"} (${opt.titulo})`, gasto: opt.precio, fecha: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }) };
    keysUser.push(nuevaCompra);

    await update(ref(db), { [`users/${realId}/saldo`]: nuevoSaldo, [`users/${realId}/keys_compradas`]: keysUser, [`productos/${prodId}/opciones/${optId}/keys`]: keysDisp.slice(1) });
    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nCompraste: *${opt.titulo}*\nKey: \`${keyEntregada}\`\n💰 Saldo: $${nuevoSaldo}`, { parse_mode: "Markdown" });
    
    if (keysDisp.slice(1).length === 0) {
      PRINCIPAL_ADMINS.forEach((adminId) => {
        // Buscamos si el admin tiene sesión activa para avisarle
        get(ref(db, 'sessions')).then(sSnap => {
          if(sSnap.exists()){
            sSnap.forEach(s => { if(s.val().realId == adminId) bot.sendMessage(s.key, `⚠️ *ALERTA DE INVENTARIO*\nSe agotaron las keys de ${prodNameSnap.val()} (${opt.titulo}).`, { parse_mode: "Markdown" }).catch(() => {}); });
          }
        });
      });
    }
    return responder();
  }

  // GESTIÓN ADMINS
  if (isPrincipal) {
    if (data === "admin_add") {
      userStates[chatId] = { step: 'AWAITING_NEW_ADMIN_USER' };
      bot.sendMessage(chatId, "Pídele al nuevo admin su **Nombre de Usuario** (debe estar registrado) y envíalo aquí:");
    }
    if (data === "admin_remove") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `❌ Eliminar Admin ID interno: ${id}`, callback_data: `del_admin:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin a revocar:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('del_admin:')) {
      await remove(ref(db, `sub_admins/${data.split(':')[1]}`));
      bot.editMessageText(`✅ Admin revocado correctamente.`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" });
    }
    if (data === "admin_perms") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `⚙️ Configurar ID interno: ${id}`, callback_data: `edit_perms:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('edit_perms:')) {
      const adminId = data.split(':')[1];
      const permisos = (await get(ref(db, `sub_admins/${adminId}/permisos`))).val() || {};
      const btn = (name, key) => [{ text: `${permisos[key] ? '✅' : '❌'} ${name}`, callback_data: `tgl_p:${adminId}:${key}` }];
      bot.editMessageText(`🎛️ *Permisos:*\nToca para activarlo/desactivarlo.`, {
        chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            btn('Agregar Saldo', 'add_saldo'), btn('Quitar Saldo', 'remove_saldo'),
            btn('Crear Prod.', 'create_prod'), btn('Gestionar Prod.', 'manage_prod'),
            btn('Ver Stocks', 'view_stock'), btn('Editar Precios', 'edit_price'),
            btn('Ver Historial', 'view_history'), [{ text: "🔙 Volver a la lista", callback_data: "admin_perms" }]
          ]
        }
      });
    }
    if (data.startsWith('tgl_p:')) {
      const [, adminId, permKey] = data.split(':');
      const permRef = ref(db, `sub_admins/${adminId}/permisos/${permKey}`);
      const currentVal = (await get(permRef)).val() || false;
      await set(permRef, !currentVal);
      query.data = `edit_perms:${adminId}`;
      bot.emit('callback_query', query); return; 
    }
  }

  // GESTIÓN PRODUCTOS ADMIN
  if (isAdmin) {
    if (data.startsWith('edit_prod:')) {
      const prodId = data.split(':')[1];
      bot.sendMessage(chatId, `⚙️ *Opciones del producto:*`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
            [{ text: "➕ Agregar Duración/Precio", callback_data: `add_opt:${prodId}` }],
            [{ text: "🔑 Agregar Keys a Duración", callback_data: `choose_opt_keys:${prodId}` }],
            [{ text: "🗑️ Eliminar Producto", callback_data: `del_prod:${prodId}` }]
          ] }
      });
    }
    if (data.startsWith('choose_opt_keys:')) {
      const prodId = data.split(':')[1];
      const opciones = (await get(ref(db, `productos/${prodId}/opciones`))).val();
      const botones = [];
      for (const optId in opciones) botones.push([{ text: `🔑 ${opciones[optId].titulo} - $${opciones[optId].precio}`, callback_data: `add_keys:${prodId}:${optId}` }]);
      bot.sendMessage(chatId, "Selecciona la duración:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('edit_price_prod:')) {
      const prodId = data.split(':')[1];
      const opciones = (await get(ref(db, `productos/${prodId}/opciones`))).val();
      const botones = [];
      for (const optId in opciones) botones.push([{ text: `${opciones[optId].titulo} (Actual: $${opciones[optId].precio})`, callback_data: `edit_price_opt:${prodId}:${optId}` }]);
      bot.sendMessage(chatId, "Selecciona la duración:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('edit_price_opt:')) {
      const [, prodId, optId] = data.split(':');
      userStates[chatId] = { step: 'AWAITING_NEW_PRICE', prodId, optId };
      bot.sendMessage(chatId, "Escribe el **nuevo precio** (solo número):", { parse_mode: "Markdown" });
    }
    if (data.startsWith('del_prod:')) {
      await remove(ref(db, `productos/${data.split(':')[1]}`));
      bot.sendMessage(chatId, "🗑️ ✅ Producto eliminado.");
    }
    if (data.startsWith('add_opt:')) {
      userStates[chatId] = { step: 'AWAITING_OPT_NAME', prodId: data.split(':')[1] };
      bot.sendMessage(chatId, "Escribe el **título y precio** (Ej: `1 dia 3$`)", { parse_mode: "Markdown" });
    }
    if (data.startsWith('add_keys:')) {
      const [, prodId, optId] = data.split(':');
      userStates[chatId] = { step: 'AWAITING_KEYS', prodId, optId };
      bot.sendMessage(chatId, "Envía las **Keys** una debajo de otra:", { parse_mode: "Markdown" });
    }
  }

  responder();
});

console.log("Bot TEMO STORE iniciado...");
console.log("Bot TIKTOK GRATIS iniciado...");
