/* ────────────────────────────────────────────────────────────
   TELEGRAM ENGINE — Notificaciones de auditoría vía Bot de Telegram
   Envía mensajes HTML únicamente al chat privado del bot.
   No bloquea la interfaz: se dispara de forma "fire-and-forget"
   desde los controladores (Eliminar / Cargar / Descargar / Guardar),
   pero expone una función async por si se desea awaitear/loguear.
──────────────────────────────────────────────────────────── */
const TelegramEngine = {

  /* ── Configuración del Bot ── */
  BOT_TOKEN: '8753096650:AAFHirqAgwydV497ylJasO5jkm0pbqmXAVI',
  CHAT_IDS: [
    '1300912802',    // Chat privado (único destino)
  ],

  /* ── Escapa caracteres especiales de HTML para Telegram parse_mode=HTML ── */
  _escapeHtml(text) {
    if (text === undefined || text === null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  /* ── Envía el mensaje a un único chat_id ── */
  async _sendToChat(chatId, message) {
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`[TelegramEngine] Error al enviar a ${chatId}:`, errData.description || res.statusText);
        return { chatId, ok: false, error: errData.description || res.statusText };
      }

      return { chatId, ok: true };
    } catch (err) {
      console.error(`[TelegramEngine] Excepción al enviar a ${chatId}:`, err);
      return { chatId, ok: false, error: err.message };
    }
  },

  /* ── Construye el cuerpo del mensaje HTML según la acción ── */
  _buildMessage({ action, user, fileName, extra }) {
    const icons = {
      eliminar:   '🗑️',
      cargar:     '📥',
      descargar:  '📤',
      guardar:    '💾',
    };
    const titles = {
      eliminar:   'ELIMINACIÓN DE ARCHIVO',
      cargar:     'CARGA DE ARCHIVO AL DASHBOARD',
      descargar:  'DESCARGA DE ARCHIVO',
      guardar:    'GUARDADO DE ARCHIVO EN GITHUB',
    };

    const icon  = icons[action]  || 'ℹ️';
    const title = titles[action] || 'ACCIÓN REGISTRADA';
    const now   = new Date().toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'medium' });

    let msg = `${icon} <b>${title}</b>\n\n`;
    msg += `👤 <b>Usuario:</b> ${this._escapeHtml(user)}\n`;
    msg += `📄 <b>Archivo:</b> ${this._escapeHtml(fileName)}\n`;
    msg += `🕒 <b>Fecha/Hora:</b> ${this._escapeHtml(now)}\n`;
    if (extra) msg += `📝 <b>Detalle:</b> ${this._escapeHtml(extra)}\n`;
    msg += `\n🔒 <i>Notificación automática de auditoría — Dashboard Asistencias</i>`;

    return msg;
  },

  /**
   * Notifica una acción de auditoría a AMBOS destinos (chat privado + canal)
   * de forma simultánea (Promise.allSettled para no bloquear ni fallar en cascada).
   *
   * @param {Object} params
   * @param {'eliminar'|'cargar'|'descargar'} params.action - Tipo de acción
   * @param {string} params.user - Nombre de la persona que ejecuta la acción
   * @param {string} params.fileName - Nombre del archivo involucrado
   * @param {string} [params.extra] - Información adicional opcional
   * @returns {Promise<Array>} Resultados del envío a cada chat
   */
  async notify({ action, user, fileName, extra = '' }) {
    try {
      const message = this._buildMessage({ action, user, fileName, extra });
      const sends = this.CHAT_IDS.map(chatId => this._sendToChat(chatId, message));
      const results = await Promise.allSettled(sends);

      const failed = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok));
      if (failed.length > 0) {
        console.warn('[TelegramEngine] Algunas notificaciones no se enviaron correctamente:', failed);
      }

      return results;
    } catch (err) {
      /* Nunca debe romper el flujo principal de la app */
      console.error('[TelegramEngine] Error inesperado en notify():', err);
      return [];
    }
  },
};
