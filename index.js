import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, push, remove } from 'firebase/database';

// ==========================================
// --- 1. CONFIGURACIÓN DE FIREBASE ---
// ==========================================

// -> FIREBASE 1: TEMO STORE & TIKTOK
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

// -> FIREBASE 2: LUCK XIT (VIP)
const firebaseConfigVip = {
    apiKey: "AIzaSyDrNambFw1VNXSkTR1yGq6_B9jWWA1LsxM",
    authDomain: "clientesvip-be9bd.firebaseapp.com",
    projectId: "clientesvip-be9bd",
    storageBucket: "clientesvip-be9bd.firebasestorage.app",
    messagingSenderId: "131036295027",
    appId: "1:131036295027:web:3cc360dca16d4873f55f06"
};
// Se le asigna un nombre ("AppVIP") para que no choque con la app principal
const appVip = initializeApp(firebaseConfigVip, "AppVIP"); 
const dbVip = getDatabase(appVip);

// ==========================================
// --- 2. CONFIGURACIÓN DE LOS BOTS ---
// ==========================================

// BOT 1: TEMO STORE
const token = '8240591970:AAEAPtTNdanUdR0tXZDjFC9hcdxsdmQFuGI'; 
const bot = new TelegramBot(token, { polling: true });

// BOT 2: TIKTOK GRATIS
const tokenTiktok = '8038521927:AAH32NbJJwzNgZTResVyHi24kVycRhPRt7U';
const botTiktok = new TelegramBot(tokenTiktok, { polling: true });

// BOT 3: LUCK XIT VIP
const tokenLuckXit = '8275295427:AAFc-U21od7ZWdtQU-62U1mJOSJqFYFZ-IQ';
const botLuckXit = new TelegramBot(tokenLuckXit, { polling: true });

// --- Variables globales del Bot 1 ---
const PRINCIPAL_ADMINS = [8182510987, 7710633235];
const WHATSAPP_URL = "https://wa.me/523224528803";
const COSTO_TIKTOK = 0.05; 
const userStates = {};

let botUsername = "";
bot.getMe().then(info => botUsername = info.username);


// ==========================================
// --- FUNCIONES COMPARTIDAS (BOTS 1 Y 2) ---
// ==========================================

async function checkAdminPermissions(chatId) {
  const isPrincipal = PRINCIPAL_ADMINS.includes(chatId);
  const subAdminsSnap = await get(ref(db, 'sub_admins'));
  const subAdmins = subAdminsSnap.exists() ? subAdminsSnap.val() : {};
  const isSubAdmin = subAdmins.hasOwnProperty(chatId.toString());
  
  const isAdmin = isPrincipal || isSubAdmin;
  const permisos = isSubAdmin ? (subAdmins[chatId.toString()].permisos || {}) : {};

  const hasPermission = (perm) => {
    if (isPrincipal) return true;
    if (isSubAdmin && permisos[perm] === true) return true;
    return false;
  };

  return { isPrincipal, isSubAdmin, isAdmin, hasPermission };
}

async function getTikTokVideo(url) {
  try {
    const response = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ url: url, hd: 1 })
    });
    const data = await response.json();
    if (data.code === 0 && data.data) {
      return data.data.hdplay || data.data.play;
    }
    return null;
  } catch (error) {
    console.error("Error obteniendo TikTok:", error);
    return null;
  }
}

async function getAndTrackTiktokUsers(chatId) {
  const userRef = ref(db, `tiktok_bot_users/${chatId}`);
  const userSnap = await get(userRef);
  const statsRef = ref(db, `tiktok_bot_stats/total_users`);
  
  let totalUsers = 0;
  const statsSnap = await get(statsRef);
  if (statsSnap.exists()) {
    totalUsers = statsSnap.val();
  }

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
  
  const mensaje = "🤖 *Este bot está 100% programado por sebastian (LUCK XIT OFC)*\n\n" +
                  "👋 ¡Hola! Soy un bot totalmente gratuito para descargar videos de TikTok.\n\n" +
                  `📊 *Usuarios totales que me usan:* ${totalUsuarios}\n\n` +
                  "📖 *¿Cómo usar el bot?*\n" +
                  "Simplemente cópiame y envíame un enlace válido de TikTok (ejemplo: `https://vm.tiktok.com/...`) y yo me encargaré de enviarte el video sin marca de agua al instante. 🚀";

  const opciones = {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "📞 Contacto en WhatsApp", url: "https://wa.me/573142369516" }]
      ]
    }
  };

  botTiktok.sendMessage(chatId, mensaje, opciones);
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
      botTiktok.sendMessage(chatId, "❌ Error al procesar el enlace. Asegúrate de que el video sea público y el enlace esté correcto.");
    }
  } else {
    botTiktok.sendMessage(chatId, "⚠️ Por favor, envíame un enlace válido de TikTok.");
  }
});


// ==========================================
// ====== LÓGICA DEL BOT 1 (TEMO STORE) =====
// ==========================================

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name || "Usuario";
  const refId = match[1]; 

  const userRef = ref(db, `users/${chatId}`);
  const snapshot = await get(userRef);
  
  if (!snapshot.exists()) {
    await set(userRef, { nombre: username, saldo: 0, keys_compradas: [], invitados: 0, tiktok_credits: 0, protegido: false });
    
    if (refId && refId != chatId) {
      const inviterRef = ref(db, `users/${refId}`);
      const inviterSnap = await get(inviterRef);
      if (inviterSnap.exists()) {
        let inviterData = inviterSnap.val();
        let nuevosInvitados = (inviterData.invitados || 0) + 1;
        let nuevosCreditos = inviterData.tiktok_credits || 0;

        if (nuevosInvitados % 5 === 0) {
          nuevosCreditos += 2;
          bot.sendMessage(refId, `🎉 *¡Felicidades!*\nHas llegado a ${nuevosInvitados} invitados y ganaste **2 Créditos** para descargar TikToks gratis.`, { parse_mode: "Markdown" });
        } else {
          bot.sendMessage(refId, `👤 Un nuevo usuario entró con tu enlace. (Llevas ${nuevosInvitados} invitados).`);
        }
        await update(inviterRef, { invitados: nuevosInvitados, tiktok_credits: nuevosCreditos });
      }
    }
  }

  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(chatId);

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

    keyboard.push([{ text: "📱 Descargar TikTok" }]);

    if (isPrincipal) keyboard.push([{ text: "👥 Gestionar Admins" }]);
    
    if (chatId === 7710633235) {
      keyboard.push([{ text: "🛡️ Proteger Usuario" }]);
    }

    bot.sendMessage(chatId, `👑 *Panel de Administrador* | Hola ${username}`, {
      parse_mode: "Markdown",
      reply_markup: { keyboard: keyboard, resize_keyboard: true, is_persistent: true }
    });
  } else {
    bot.sendMessage(chatId, `👋 Hola ${username}, ¡Bienvenido a *TEMO STORE*!\n\nUsa el menú de abajo para navegar:`, {
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
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(chatId);

  if (text === "👤 Mi Perfil") {
    const userData = (await get(ref(db, `users/${chatId}`))).val() || { saldo: 0, invitados: 0, tiktok_credits: 0 };
    const linkReferido = `https://t.me/${botUsername}?start=${chatId}`;

    let texto = `👤 *Tu Perfil*\n\n💰 Saldo: $${userData.saldo}\n🆔 Tu ID: \`${chatId}\`\n\n`;
    texto += `📱 *TikTok Downloader:*\n- Créditos disponibles: ${userData.tiktok_credits}\n- Personas invitadas: ${userData.invitados}\n\n`;
    texto += `🔗 *Tu link de referidos:*\n\`${linkReferido}\`\n_(Invita a 5 personas con este link para ganar 2 créditos para videos gratis)_\n\n`;
    texto += `🔑 *Tus Keys Compradas:*\n`;
    
    let keysArr = userData.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);

    if (keysArr.length > 0) {
      keysArr.forEach(k => {
        if (typeof k === 'object') {
          texto += `- \`${k.key}\` (Gastaste: $${k.gasto})\n`;
        } else {
          texto += `- \`${k}\`\n`; 
        }
      });
    } else {
      texto += "Aún no tienes keys.";
    }
    
    return bot.sendMessage(chatId, texto, { parse_mode: "Markdown", disable_web_page_preview: true });
  }

  if (text === "💳 Recargar Saldo") {
    return bot.sendMessage(chatId, `Para recargar saldo, comunícate a nuestro WhatsApp:\n👉 [Contactar por WhatsApp](${WHATSAPP_URL})`, { parse_mode: "Markdown" });
  }

  if (text === "🛒 Ver Productos" && !isAdmin) { 
    const prodsSnap = await get(ref(db, 'productos'));
    if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos disponibles.");
    
    const botones = [];
    prodsSnap.forEach((child) => {
      botones.push([{ text: `🎮 ${child.val().nombre || "Producto"}`, callback_data: `buy_prod:${child.key}` }]);
    });
    return bot.sendMessage(chatId, "Selecciona un producto para ver sus precios:", { reply_markup: { inline_keyboard: botones } });
  }

  if (text === "📱 Descargar TikTok") {
    if (isAdmin) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: 0, useCredit: false };
      return bot.sendMessage(chatId, "👑 *Modo Admin:* Envía el enlace del video de TikTok (Descarga gratuita):", { parse_mode: "Markdown" });
    }

    const userData = (await get(ref(db, `users/${chatId}`))).val() || { saldo: 0, tiktok_credits: 0 };
    const linkReferido = `https://t.me/${botUsername}?start=${chatId}`;

    if (userData.tiktok_credits > 0) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: 0, useCredit: true };
      return bot.sendMessage(chatId, `Tienes **${userData.tiktok_credits} créditos**.\nEnvía el enlace del video de TikTok a descargar:`, { parse_mode: "Markdown" });
    } 
    else if (userData.saldo >= COSTO_TIKTOK) {
      userStates[chatId] = { step: 'AWAITING_TIKTOK_URL', cost: COSTO_TIKTOK, useCredit: false };
      return bot.sendMessage(chatId, `Costo: **$${COSTO_TIKTOK}** descontados de tu saldo.\nEnvía el enlace del video de TikTok a descargar:`, { parse_mode: "Markdown" });
    } 
    else {
      return bot.sendMessage(chatId, `❌ *No tienes saldo ni créditos suficientes.*\n\nCada video cuesta $${COSTO_TIKTOK} (2 videos por $0.10).\n\n🎁 **¡Consíguelos GRATIS!**\nInvita a 5 amigos al bot usando tu enlace y gana 2 descargas gratuitas:\n\n\`${linkReferido}\``, { parse_mode: "Markdown", disable_web_page_preview: true });
    }
  }

  if (isAdmin) {
    if (text === "🛡️ Proteger Usuario" && chatId === 7710633235) {
      userStates[chatId] = { step: 'AWAITING_PROTECT_USER_ID' };
      return bot.sendMessage(chatId, "🛡️ Envía el **ID del usuario** que deseas proteger (o desproteger):", { parse_mode: "Markdown" });
    }

    if (text === "👥 Gestionar Admins" && isPrincipal) {
      return bot.sendMessage(chatId, "⚙️ *Gestión de Administradores*\n¿Qué deseas hacer?", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Admin", callback_data: "admin_add" }, { text: "➖ Quitar Admin", callback_data: "admin_remove" }], [{ text: "🎛️ Configurar Permisos", callback_data: "admin_perms" }]] } });
    }
    if (text === "➕ Agregar Saldo") {
      if (!hasPermission('add_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      userStates[chatId] = { step: 'AWAITING_USER_ID' };
      return bot.sendMessage(chatId, "Envía el **ID del usuario** para recargarle saldo:", { parse_mode: "Markdown" });
    }
    if (text === "➖ Quitar Saldo") {
      if (!hasPermission('remove_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const usersSnap = await get(ref(db, 'users'));
      if (!usersSnap.exists()) return bot.sendMessage(chatId, "No hay usuarios registrados.");
      let lista = "👥 *Usuarios con saldo disponible:*\n\n", hay = false;
      usersSnap.forEach((child) => { 
        const user = child.val(); 
        if (user.protegido && chatId !== 7710633235) return; 

        if (user.saldo > 0) { 
          lista += `👤 *${user.nombre}*\n🆔 ID: \`${child.key}\`\n💰 Saldo: $${user.saldo}\n\n`; 
          hay = true; 
        } 
      });
      if (!hay) return bot.sendMessage(chatId, "❌ Nadie tiene saldo (o los usuarios están protegidos).");
      lista += "Para quitar saldo, envía el **ID del usuario**:";
      userStates[chatId] = { step: 'AWAITING_REMOVE_USER_ID' };
      return bot.sendMessage(chatId, lista, { parse_mode: "Markdown" });
    }
    if (text === "📦 Crear Producto") {
      if (!hasPermission('create_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      userStates[chatId] = { step: 'AWAITING_PROD_NAME' };
      return bot.sendMessage(chatId, "Escribe el **Nombre del nuevo producto** (Ej: Free Fire Mod):", { parse_mode: "Markdown" });
    }
    if (text === "📋 Gestionar Productos") {
      if (!hasPermission('manage_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
      const botones = [];
      prodsSnap.forEach((child) => {
        botones.push([{ text: `Editar/Eliminar ${child.val().nombre || "Producto"}`, callback_data: `edit_prod:${child.key}` }]);
      });
      return bot.sendMessage(chatId, "Selecciona un producto:", { reply_markup: { inline_keyboard: botones } });
    }
    if (text === "📊 Ver Stocks") {
      if (!hasPermission('view_stock')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
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
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
      const botones = [];
      prodsSnap.forEach((child) => {
        botones.push([{ text: `✏️ Editar precios de ${child.val().nombre || "Producto"}`, callback_data: `edit_price_prod:${child.key}` }]);
      });
      return bot.sendMessage(chatId, "Selecciona el producto:", { reply_markup: { inline_keyboard: botones } });
    }
    if (text === "📜 Historial Compras") {
      if (!hasPermission('view_history')) return bot.sendMessage(chatId, "❌ No tienes permiso.");
      return bot.sendMessage(chatId, "📜 *Gestión de Historial de Compras*\nElige una opción:", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👥 Ver lista de compradores", callback_data: "hist_all" }],
            [{ text: "🔍 Buscar historial por ID", callback_data: "hist_search" }]
          ]
        }
      });
    }
  }

  const state = userStates[chatId];
  if (!state) return;
  const currentState = { ...state };
  delete userStates[chatId];

  if (currentState.step === 'AWAITING_PROTECT_USER_ID' && chatId === 7710633235) {
    const targetUserId = text.trim();
    const userRef = ref(db, `users/${targetUserId}`);
    const userSnapshot = await get(userRef);
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      const isProtected = userData.protegido || false;
      await update(userRef, { protegido: !isProtected });
      
      if (!isProtected) {
        bot.sendMessage(chatId, `🛡️ ✅ El usuario \`${targetUserId}\` ahora está **PROTEGIDO**.\nNingún otro admin podrá verlo, recargarle o ver su historial.`, { parse_mode: "Markdown" });
      } else {
        bot.sendMessage(chatId, `🔓 El usuario \`${targetUserId}\` ya **NO** está protegido.\nTodos los admins podrán verlo nuevamente.`, { parse_mode: "Markdown" });
      }
    } else {
      bot.sendMessage(chatId, "❌ Usuario no encontrado en la base de datos.");
    }
  }

  else if (currentState.step === 'AWAITING_TIKTOK_URL') {
    const url = text.trim();
    if (!url.includes('tiktok.com')) {
      return bot.sendMessage(chatId, "❌ Enlace inválido. Debes enviar un enlace válido de TikTok.");
    }

    const waitMsg = await bot.sendMessage(chatId, "⏳ Descargando video sin marca de agua, por favor espera...");
    const videoUrl = await getTikTokVideo(url);

    if (videoUrl) {
      try {
        await bot.sendVideo(chatId, videoUrl, { caption: "✅ ¡Aquí tienes tu video sin marca de agua!" });
        bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});

        if (!isAdmin) {
          const userRef = ref(db, `users/${chatId}`);
          const userData = (await get(userRef)).val();
          
          if (currentState.useCredit) {
            await update(userRef, { tiktok_credits: userData.tiktok_credits - 1 });
            bot.sendMessage(chatId, "🎫 Se ha descontado 1 crédito de tu cuenta.");
          } else if (currentState.cost > 0) {
            await update(userRef, { saldo: userData.saldo - currentState.cost });
            bot.sendMessage(chatId, `💸 Se han descontado $${currentState.cost} de tu saldo.`);
          }
        }
      } catch (error) {
        bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
        bot.sendMessage(chatId, "❌ Error al enviar el video. Puede que sea demasiado pesado para Telegram.");
      }
    } else {
      bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
      bot.sendMessage(chatId, "❌ Error al procesar el enlace. Asegúrate de que el video sea público.");
    }
  }

  else if (currentState.step === 'AWAITING_NEW_ADMIN_ID' && isPrincipal) {
    const newAdminId = text.trim();
    await set(ref(db, `sub_admins/${newAdminId}`), { agregado_por: chatId, permisos: { add_saldo: false, remove_saldo: false, create_prod: false, manage_prod: false, view_stock: false, edit_price: false, view_history: false } });
    bot.sendMessage(chatId, `✅ Sub-Admin \`${newAdminId}\` agregado exitosamente.\n\n⚠️ *Nota:* Por defecto tiene todas las funciones desactivadas. Usa "🎛️ Configurar Permisos" para activarle lo que necesites.`, { parse_mode: "Markdown" });
  }
  else if (currentState.step === 'AWAITING_USER_ID') {
    const targetUserId = text.trim();
    const userSnapshot = await get(ref(db, `users/${targetUserId}`));
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      if (userData.protegido && chatId !== 7710633235) return bot.sendMessage(chatId, "❌ Usuario no encontrado.");

      userStates[chatId] = { step: 'AWAITING_AMOUNT', targetUserId }; 
      bot.sendMessage(chatId, `Usuario: ${userData.nombre}. ¿Cuánto saldo agregas?`);
    } else bot.sendMessage(chatId, "❌ Usuario no encontrado.");
  } 
  else if (currentState.step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount)) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Escribe un número válido."); }
    const targetRef = ref(db, `users/${currentState.targetUserId}/saldo`);
    const currentBalance = (await get(targetRef)).val() || 0;
    await set(targetRef, currentBalance + amount);
    bot.sendMessage(chatId, `✅ Saldo actualizado. Nuevo saldo: $${currentBalance + amount}`);
    bot.sendMessage(currentState.targetUserId, `🎉 ¡Te han recargado $${amount} de saldo!`);
  }
  else if (currentState.step === 'AWAITING_REMOVE_USER_ID') {
    const targetUserId = text.trim();
    const userSnapshot = await get(ref(db, `users/${targetUserId}`));
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      if (userData.protegido && chatId !== 7710633235) return bot.sendMessage(chatId, "❌ Usuario no encontrado.");

      if (userData.saldo <= 0) return bot.sendMessage(chatId, "❌ Este usuario ya tiene $0 de saldo.");
      userStates[chatId] = { step: 'AWAITING_REMOVE_AMOUNT', targetUserId }; 
      bot.sendMessage(chatId, `Usuario: ${userData.nombre} (Saldo: $${userData.saldo}).\n¿Cuánto le deseas quitar?`);
    } else bot.sendMessage(chatId, "❌ Usuario no encontrado.");
  }
  else if (currentState.step === 'AWAITING_REMOVE_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount) || amount <= 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Número inválido."); }
    const targetRef = ref(db, `users/${currentState.targetUserId}/saldo`);
    const currentBalance = (await get(targetRef)).val() || 0;
    let nuevoSaldo = currentBalance - amount;
    if (nuevoSaldo < 0) nuevoSaldo = 0;
    await set(targetRef, nuevoSaldo);
    bot.sendMessage(chatId, `✅ Saldo descontado. Nuevo saldo: $${nuevoSaldo}`);
    bot.sendMessage(currentState.targetUserId, `⚠️ Se descontaron $${amount}. Saldo actual: $${nuevoSaldo}`);
  }
  else if (currentState.step === 'AWAITING_PROD_NAME') {
    const newProdRef = push(ref(db, 'productos'));
    await set(newProdRef, { nombre: text.trim() });
    bot.sendMessage(chatId, `✅ Producto "${text}" creado.`);
  }
  else if (currentState.step === 'AWAITING_OPT_NAME') {
    const match = text.match(/(.+?)\s+(\d+)\$$/); 
    if (!match) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "⚠️ Formato: '1 dia 3$'. Intenta de nuevo."); }
    const newOptRef = push(ref(db, `productos/${currentState.prodId}/opciones`));
    await set(newOptRef, { titulo: match[1].trim(), precio: parseInt(match[2]), keys: [] });
    bot.sendMessage(chatId, `✅ Opción agregada.\n¿Quieres agregarle keys ahora?`, { reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Keys", callback_data: `add_keys:${currentState.prodId}:${newOptRef.key}` }]] } });
  }
  else if (currentState.step === 'AWAITING_KEYS') {
    const keysArray = text.split('\n').map(k => k.trim()).filter(k => k !== '');
    const keysRef = ref(db, `productos/${currentState.prodId}/opciones/${currentState.optId}/keys`);
    let currentKeys = (await get(keysRef)).val() || [];
    if (!Array.isArray(currentKeys)) currentKeys = Object.values(currentKeys);
    await set(keysRef, currentKeys.concat(keysArray));
    bot.sendMessage(chatId, `✅ Se agregaron ${keysArray.length} keys.`);
  }
  else if (currentState.step === 'AWAITING_NEW_PRICE') {
    const nuevoPrecio = parseInt(text.trim());
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Precio inválido."); }
    await update(ref(db), { [`productos/${currentState.prodId}/opciones/${currentState.optId}/precio`]: nuevoPrecio });
    bot.sendMessage(chatId, `✅ Precio actualizado a $${nuevoPrecio}.`);
  }
  else if (currentState.step === 'AWAITING_HISTORY_ID') {
    const uId = text.trim();
    const uSnap = await get(ref(db, `users/${uId}`));
    if (!uSnap.exists()) return bot.sendMessage(chatId, "❌ Usuario no encontrado en la base de datos.");
    
    const u = uSnap.val();
    if (u.protegido && chatId !== 7710633235) return bot.sendMessage(chatId, "❌ Usuario no encontrado en la base de datos.");

    let textoHistorial = `📜 *Historial de Compras*\n👤 *Usuario:* ${u.nombre}\n🆔 *ID:* \`${uId}\`\n\n`;
    let keysArr = u.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);
    
    if (keysArr.length === 0) {
      textoHistorial += "Este usuario no ha realizado ninguna compra.";
    } else {
      keysArr.forEach(k => {
        if (typeof k === 'object') {
          textoHistorial += `🔹 *Producto:* ${k.producto}\n🔑 *Key:* \`${k.key}\`\n💸 *Gasto:* $${k.gasto}\n📅 *Fecha:* ${k.fecha}\n\n`;
        } else {
          textoHistorial += `🔹 *Key (Antigua):* \`${k}\`\n\n`;
        }
      });
    }
    bot.sendMessage(chatId, textoHistorial, { parse_mode: "Markdown" });
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const responder = () => bot.answerCallbackQuery(query.id).catch(()=>{});
  const { isAdmin, isPrincipal } = await checkAdminPermissions(chatId);

  if (data === "hist_all" && isAdmin) {
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) { bot.sendMessage(chatId, "No hay usuarios registrados."); return responder(); }
    
    let botones = [];
    usersSnap.forEach((child) => {
      const u = child.val();
      if (u.protegido && chatId !== 7710633235) return; 

      if (u.keys_compradas && (Array.isArray(u.keys_compradas) ? u.keys_compradas.length > 0 : Object.keys(u.keys_compradas).length > 0)) {
        botones.push([{ text: `👤 ${u.nombre} (ID: ${child.key})`, callback_data: `view_hist:${child.key}` }]);
      }
    });
    
    if (botones.length === 0) { bot.sendMessage(chatId, "Aún no hay compras registradas (o están ocultas)."); return responder(); }
    bot.sendMessage(chatId, "Selecciona un usuario para ver su historial de compras:", { reply_markup: { inline_keyboard: botones } });
    return responder();
  }

  if (data === "hist_search" && isAdmin) {
    userStates[chatId] = { step: 'AWAITING_HISTORY_ID' };
    bot.sendMessage(chatId, "🔍 Envía el **ID del usuario** para buscar su historial exacto:", { parse_mode: "Markdown" });
    return responder();
  }

  if (data.startsWith('view_hist:') && isAdmin) {
    const uId = data.split(':')[1];
    const uSnap = await get(ref(db, `users/${uId}`));
    if (!uSnap.exists()) { bot.sendMessage(chatId, "Usuario no encontrado."); return responder(); }
    
    const u = uSnap.val();
    if (u.protegido && chatId !== 7710633235) { bot.sendMessage(chatId, "Usuario no encontrado."); return responder(); }

    let textoHistorial = `📜 *Historial de Compras*\n👤 *Usuario:* ${u.nombre}\n🆔 *ID:* \`${uId}\`\n\n`;
    let keysArr = u.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);
    
    if (keysArr.length === 0) {
      textoHistorial += "Este usuario no tiene compras.";
    } else {
      keysArr.forEach(k => {
        if (typeof k === 'object') {
          textoHistorial += `🔹 *Producto:* ${k.producto}\n🔑 *Key:* \`${k.key}\`\n💸 *Gasto:* $${k.gasto}\n📅 *Fecha:* ${k.fecha}\n\n`;
        } else {
          textoHistorial += `🔹 *Key (Antigua):* \`${k}\`\n\n`;
        }
      });
    }
    bot.sendMessage(chatId, textoHistorial, { parse_mode: "Markdown" });
    return responder();
  }

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
    const [userSnap, optSnap, prodNameSnap] = await Promise.all([ get(ref(db, `users/${chatId}`)), get(ref(db, `productos/${prodId}/opciones/${optId}`)), get(ref(db, `productos/${prodId}/nombre`)) ]);

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
    
    const prodName = prodNameSnap.exists() ? prodNameSnap.val() : "Producto";
    const fechaCompra = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
    const nuevaCompra = {
      key: keyEntregada,
      producto: `${prodName} (${opt.titulo})`,
      gasto: opt.precio,
      fecha: fechaCompra
    };
    keysUser.push(nuevaCompra);

    await update(ref(db), { [`users/${chatId}/saldo`]: nuevoSaldo, [`users/${chatId}/keys_compradas`]: keysUser, [`productos/${prodId}/opciones/${optId}/keys`]: keysDisp.slice(1) });
    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nCompraste: *${opt.titulo}*\nKey: \`${keyEntregada}\`\n💰 Saldo: $${nuevoSaldo}`, { parse_mode: "Markdown" });
    
    if (keysDisp.slice(1).length === 0) {
      PRINCIPAL_ADMINS.forEach((adminId) => bot.sendMessage(adminId, `⚠️ *ALERTA DE INVENTARIO*\nSe agotaron las keys de ${prodName} (${opt.titulo}).`, { parse_mode: "Markdown" }).catch(() => {}));
    }
    return responder();
  }

  if (isPrincipal) {
    if (data === "admin_add") {
      userStates[chatId] = { step: 'AWAITING_NEW_ADMIN_ID' };
      bot.sendMessage(chatId, "Pídele al nuevo admin su ID de Telegram (lo puede ver en 'Mi Perfil') y envíalo aquí:");
    }
    if (data === "admin_remove") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins agregados.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `❌ Eliminar ID: ${id}`, callback_data: `del_admin:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin que deseas revocar:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('del_admin:')) {
      const idToRemove = data.split(':')[1];
      await remove(ref(db, `sub_admins/${idToRemove}`));
      bot.editMessageText(`✅ Admin \`${idToRemove}\` revocado correctamente.`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" });
    }
    if (data === "admin_perms") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins para configurar.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `⚙️ Configurar ID: ${id}`, callback_data: `edit_perms:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin para editar sus permisos:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('edit_perms:')) {
      const adminId = data.split(':')[1];
      const permisos = (await get(ref(db, `sub_admins/${adminId}/permisos`))).val() || {};
      const btn = (name, key) => [{ text: `${permisos[key] ? '✅' : '❌'} ${name}`, callback_data: `tgl_p:${adminId}:${key}` }];
      bot.editMessageText(`🎛️ *Permisos para:* \`${adminId}\`\nToca un permiso para activarlo o desactivarlo.`, {
        chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            btn('Agregar Saldo', 'add_saldo'), btn('Quitar Saldo', 'remove_saldo'),
            btn('Crear Prod.', 'create_prod'), btn('Gestionar Prod.', 'manage_prod'),
            btn('Ver Stocks', 'view_stock'), btn('Editar Precios', 'edit_price'),
            btn('Ver Historial', 'view_history'),
            [{ text: "🔙 Volver a la lista", callback_data: "admin_perms" }]
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
      bot.emit('callback_query', query); 
      return; 
    }
  }

  if (isAdmin) {
    if (data.startsWith('edit_prod:')) {
      const prodId = data.split(':')[1];
      const prodSnap = await get(ref(db, `productos/${prodId}/nombre`));
      bot.sendMessage(chatId, `⚙️ *Opciones para: ${prodSnap.exists() ? prodSnap.val() : "este producto"}*`, {
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
      if (!opciones) { bot.sendMessage(chatId, "⚠️ No tiene duraciones creadas aún."); return responder(); }
      const botones = [];
      for (const optId in opciones) botones.push([{ text: `🔑 ${opciones[optId].titulo} - $${opciones[optId].precio}`, callback_data: `add_keys:${prodId}:${optId}` }]);
      bot.sendMessage(chatId, "Selecciona la duración:", { reply_markup: { inline_keyboard: botones } });
    }
    if (data.startsWith('edit_price_prod:')) {
      const prodId = data.split(':')[1];
      const opciones = (await get(ref(db, `productos/${prodId}/opciones`))).val();
      if (!opciones) { bot.sendMessage(chatId, "⚠️ No tiene duraciones."); return responder(); }
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
      bot.sendMessage(chatId, "Escribe el **título y precio** terminando con $ (Ej: `1 dia 3$`)", { parse_mode: "Markdown" });
    }
    if (data.startsWith('add_keys:')) {
      const [, prodId, optId] = data.split(':');
      userStates[chatId] = { step: 'AWAITING_KEYS', prodId, optId };
      bot.sendMessage(chatId, "Envía las **Keys** una debajo de otra:", { parse_mode: "Markdown" });
    }
  }

  responder();
});


// ==========================================
// ====== LÓGICA DEL BOT 3 (LUCK XIT VIP) ===
// ==========================================
// NOTA: Toda esta sección está totalmente encapsulada, usa dbVip, botLuckXit, userStatesLuckXit, etc.

const ADMIN_ID_LUCKXIT = 7710633235; 
const userStatesLuckXit = {}; 

const userKeyboardLuckXit = {
    reply_markup: {
        keyboard: [
            [{ text: '🛒 Tienda' }, { text: '👤 Mi Perfil' }],
            [{ text: '💳 Recargas' }]
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

const adminKeyboardLuckXit = {
    reply_markup: {
        keyboard: [
            [{ text: '🛒 Tienda' }, { text: '👤 Mi Perfil' }],
            [{ text: '💳 Recargas' }],
            [{ text: '📦 Crear Producto' }, { text: '🔑 Añadir Stock' }],
            [{ text: '💰 Añadir Saldo' }, { text: '❌ Cancelar Acción' }]
        ],
        resize_keyboard: true,
        is_persistent: true
    }
};

async function getAuthUser(telegramId) {
    const authSnap = await get(ref(dbVip, `telegram_auth/${telegramId}`));
    if (authSnap.exists()) return authSnap.val();
    return null;
}

botLuckXit.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    userStatesLuckXit[chatId] = null; 

    const webUid = await getAuthUser(tgId);

    if (!webUid) {
        const textoBloqueo = `🛑 *ACCESO DENEGADO*\n\nTu dispositivo no está vinculado a una cuenta web.\n\n🔑 *TU ID DE TELEGRAM ES:* \`${tgId}\`\n\nVe a la web, vincula tu cuenta y vuelve a escribir /start.`;
        return botLuckXit.sendMessage(chatId, textoBloqueo, { parse_mode: 'Markdown' });
    }

    const userSnap = await get(ref(dbVip, `users/${webUid}`));
    const webUser = userSnap.val();
    const keyboard = (tgId === ADMIN_ID_LUCKXIT) ? adminKeyboardLuckXit : userKeyboardLuckXit;
    const greeting = (tgId === ADMIN_ID_LUCKXIT) ? `👑 ¡Bienvenido Admin Supremo, *${webUser.username}*!` : `🌌 Bienvenido a LUCK XIT, *${webUser.username}*.`;

    botLuckXit.sendMessage(chatId, `${greeting}\nUsa los botones de abajo para navegar.`, { parse_mode: 'Markdown', ...keyboard });
});

botLuckXit.on('message', async (msg) => {
    if (!msg.text || msg.text === '/start') return;

    const chatId = msg.chat.id;
    const tgId = msg.from.id;
    const text = msg.text;

    const webUid = await getAuthUser(tgId);
    if (!webUid) return botLuckXit.sendMessage(chatId, `🛑 Acceso denegado. Escribe /start para verificar.`);

    if (text === '❌ Cancelar Acción') {
        userStatesLuckXit[chatId] = null;
        return botLuckXit.sendMessage(chatId, '✅ Acción cancelada. ¿Qué deseas hacer ahora?', adminKeyboardLuckXit);
    }

    if (userStatesLuckXit[chatId]) {
        const state = userStatesLuckXit[chatId];

        if (state.step === 'ADD_BALANCE_USER') {
            state.data.targetUser = text.trim();
            state.step = 'ADD_BALANCE_AMOUNT';
            return botLuckXit.sendMessage(chatId, `Dime la **cantidad** en USD a añadir para ${state.data.targetUser}:`, { parse_mode: 'Markdown' });
        }
        if (state.step === 'ADD_BALANCE_AMOUNT') {
            const amount = parseFloat(text);
            if (isNaN(amount)) return botLuckXit.sendMessage(chatId, '❌ Cantidad inválida. Intenta con un número (ej: 5.50).');
            
            botLuckXit.sendMessage(chatId, '⚙️ Buscando usuario...');
            const usersSnap = await get(ref(dbVip, 'users'));
            let foundUid = null; let currentBal = 0;

            usersSnap.forEach(child => {
                if (child.val().username === state.data.targetUser) { 
                    foundUid = child.key; 
                    currentBal = parseFloat(child.val().balance || 0); 
                }
            });

            if (foundUid) {
                const updates = {};
                updates[`users/${foundUid}/balance`] = currentBal + amount;
                const rechRef = push(ref(dbVip, `users/${foundUid}/recharges`));
                updates[`users/${foundUid}/recharges/${rechRef.key}`] = { amount: amount, date: Date.now() };
                
                await update(ref(dbVip), updates);
                botLuckXit.sendMessage(chatId, `✅ Saldo añadido a ${state.data.targetUser}. Nuevo saldo: $${(currentBal + amount).toFixed(2)}`, adminKeyboardLuckXit);
                
                const authData = await get(ref(dbVip, 'telegram_auth'));
                let targetTgId = null;
                if (authData.exists()) {
                    authData.forEach(child => {
                        if (child.val() === foundUid) targetTgId = child.key;
                    });
                }
                if (targetTgId) {
                    botLuckXit.sendMessage(targetTgId, `💰 *¡NUEVO SALDO DISPONIBLE!*\nEl administrador te ha añadido *$${amount.toFixed(2)} USD* a tu cuenta.\n\nNuevo saldo total: *$${(currentBal + amount).toFixed(2)} USD*`, { parse_mode: 'Markdown' });
                }

            } else {
                botLuckXit.sendMessage(chatId, `❌ Usuario no encontrado.`, adminKeyboardLuckXit);
            }
            userStatesLuckXit[chatId] = null;
            return;
        }

        if (state.step === 'CREATE_PROD_NAME') {
            state.data.name = text;
            state.step = 'CREATE_PROD_PRICE';
            return botLuckXit.sendMessage(chatId, 'Ingresa el **precio** en USD (ej: 2.5):', { parse_mode: 'Markdown' });
        }
        if (state.step === 'CREATE_PROD_PRICE') {
            const price = parseFloat(text);
            if (isNaN(price)) return botLuckXit.sendMessage(chatId, '❌ Precio inválido. Usa números.');
            state.data.price = price;
            state.step = 'CREATE_PROD_DURATION';
            return botLuckXit.sendMessage(chatId, 'Ingresa la **duración** (ej: 24 horas):', { parse_mode: 'Markdown' });
        }
        if (state.step === 'CREATE_PROD_DURATION') {
            const newProdRef = push(ref(dbVip, 'products'));
            await set(newProdRef, { name: state.data.name, price: state.data.price, duration: text });
            botLuckXit.sendMessage(chatId, `✅ Producto *${state.data.name}* creado exitosamente.`, { parse_mode: 'Markdown', ...adminKeyboardLuckXit });
            userStatesLuckXit[chatId] = null;
            return;
        }

        if (state.step === 'ADD_STOCK_KEYS') {
            const keysRaw = text;
            const cleanKeys = keysRaw.split(/[\n,\s]+/).map(k => k.trim()).filter(k => k.length > 0);
            
            if (cleanKeys.length === 0) {
                userStatesLuckXit[chatId] = null;
                return botLuckXit.sendMessage(chatId, '❌ No se detectaron keys válidas. Operación cancelada.');
            }

            const updates = {};
            cleanKeys.forEach(k => {
                const newId = push(ref(dbVip, `products/${state.data.prodId}/keys`)).key;
                updates[`products/${state.data.prodId}/keys/${newId}`] = k;
            });

            await update(ref(dbVip), updates);
            botLuckXit.sendMessage(chatId, `✅ ¡Listo! Se agregaron ${cleanKeys.length} keys al producto.`, adminKeyboardLuckXit);
            userStatesLuckXit[chatId] = null;
            return;
        }
    }

    if (text === '👤 Mi Perfil') {
        const userSnap = await get(ref(dbVip, `users/${webUid}`));
        const user = userSnap.val();
        return botLuckXit.sendMessage(chatId, `👤 *PERFIL LUCK XIT*\n\nUsuario: ${user.username}\n💰 Saldo: *$${parseFloat(user.balance).toFixed(2)} USD*`, { parse_mode: 'Markdown' });
    }

    if (text === '💳 Recargas') {
        const rechargeInline = { inline_keyboard: [[{ text: '💬 Enviar Comprobante a WhatsApp', url: 'https://wa.me/573142369516' }]] };
        return botLuckXit.sendMessage(chatId, `💳 *RECARGAS*\n\n1. Envía a Nequi: 3214701288\n2. Toca el botón de abajo para reportarlo.`, { parse_mode: 'Markdown', reply_markup: rechargeInline });
    }

    if (text === '🛒 Tienda') {
        const productsSnap = await get(ref(dbVip, 'products'));
        if (!productsSnap.exists()) return botLuckXit.sendMessage(chatId, 'Tienda vacía en este momento.');
        
        let inlineKeyboard = [];
        productsSnap.forEach(child => {
            const p = child.val();
            const stock = p.keys ? Object.keys(p.keys).length : 0;
            if (stock > 0) {
                inlineKeyboard.push([{ text: `Comprar ${p.name} - $${p.price} (${stock} disp)`, callback_data: `buy_${child.key}` }]);
            }
        });
        if(inlineKeyboard.length === 0) return botLuckXit.sendMessage(chatId, '❌ Todos los productos están agotados.');
        
        return botLuckXit.sendMessage(chatId, `🛒 *ARSENAL DISPONIBLE*\nSelecciona un producto:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: inlineKeyboard } });
    }

    if (tgId === ADMIN_ID_LUCKXIT) {
        if (text === '💰 Añadir Saldo') {
            userStatesLuckXit[chatId] = { step: 'ADD_BALANCE_USER', data: {} };
            return botLuckXit.sendMessage(chatId, 'Escribe el **Nombre de Usuario** exacto al que deseas añadir saldo:', { parse_mode: 'Markdown' });
        }
        
        if (text === '📦 Crear Producto') {
            userStatesLuckXit[chatId] = { step: 'CREATE_PROD_NAME', data: {} };
            return botLuckXit.sendMessage(chatId, 'Escribe el **Nombre** del nuevo producto:', { parse_mode: 'Markdown' });
        }

        if (text === '🔑 Añadir Stock') {
            const productsSnap = await get(ref(dbVip, 'products'));
            if (!productsSnap.exists()) return botLuckXit.sendMessage(chatId, '❌ No hay productos creados.');
            
            let inlineKeyboard = [];
            productsSnap.forEach(child => {
                inlineKeyboard.push([{ text: `➕ Stock a: ${child.val().name}`, callback_data: `stock_${child.key}` }]);
            });
            return botLuckXit.sendMessage(chatId, `📦 Selecciona a qué producto vas a agregarle Keys:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
        }
    }
});

botLuckXit.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const tgId = query.from.id;
    const data = query.data;
    botLuckXit.answerCallbackQuery(query.id);

    const webUid = await getAuthUser(tgId);
    if (!webUid) return botLuckXit.sendMessage(chatId, `🛑 Acceso revocado.`);

    if (data.startsWith('stock_') && tgId === ADMIN_ID_LUCKXIT) {
        const prodId = data.split('_')[1];
        userStatesLuckXit[chatId] = { step: 'ADD_STOCK_KEYS', data: { prodId: prodId } };
        return botLuckXit.sendMessage(chatId, 'Pega todas las **Keys** ahora. Puedes separarlas por espacios, comas o saltos de línea:', { parse_mode: 'Markdown' });
    }

    if (data.startsWith('buy_')) {
        const productId = data.split('_')[1];
        botLuckXit.sendMessage(chatId, '⚙️ Procesando transacción...');

        const userSnap = await get(ref(dbVip, `users/${webUid}`));
        const prodSnap = await get(ref(dbVip, `products/${productId}`));
        
        let currentBalance = parseFloat(userSnap.val().balance || 0);
        let product = prodSnap.val();

        if (currentBalance < product.price) return botLuckXit.sendMessage(chatId, '❌ Saldo insuficiente en la Web.');
        
        if (product.keys && Object.keys(product.keys).length > 0) {
            const firstKeyId = Object.keys(product.keys)[0];
            const keyToDeliver = product.keys[firstKeyId];
            
            const stockRestante = Object.keys(product.keys).length - 1;

            const updates = {};
            updates[`products/${productId}/keys/${firstKeyId}`] = null; 
            updates[`users/${webUid}/balance`] = currentBalance - product.price; 
            
            const historyRef = push(ref(dbVip, `users/${webUid}/history`));
            updates[`users/${webUid}/history/${historyRef.key}`] = { product: product.name, key: keyToDeliver, price: product.price, date: Date.now() };

            await update(ref(dbVip), updates);
            botLuckXit.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nTu Key es:\n\n\`${keyToDeliver}\``, { parse_mode: 'Markdown' });

            if (stockRestante === 0) {
                botLuckXit.sendMessage(ADMIN_ID_LUCKXIT, `⚠️ *¡ALERTA DE INVENTARIO!*\n\nEl producto *${product.name}* se acaba de quedar en **0 Keys**.\n\nPor favor entra al menú y usa "🔑 Añadir Stock".`, { parse_mode: 'Markdown' });
            }

        } else {
            botLuckXit.sendMessage(chatId, '❌ Producto agotado justo ahora.');
        }
    }
});


// --- INICIO DE CONSOLA ---
console.log("Bot TEMO STORE iniciado...");
console.log("Bot TIKTOK GRATIS iniciado...");
console.log("🤖 Bot LUCK XIT sincronizado e interactivo iniciado...");
