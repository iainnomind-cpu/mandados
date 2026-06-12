import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Política de Privacidad</h1>
        
        <div className="space-y-6 text-gray-600">
          <p>
            <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-MX')}
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Información que recopilamos</h2>
            <p>
              Recopilamos información personal que usted nos proporciona voluntariamente al registrarse en el sistema,
              tales como: nombre, dirección de correo electrónico, número de teléfono (incluyendo WhatsApp) y dirección física
              para la recolección o entrega de pedidos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Uso de la información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Gestionar y entregar sus pedidos correctamente.</li>
              <li>Enviarle notificaciones sobre el estado de sus pedidos (ej. vía WhatsApp).</li>
              <li>Mejorar nuestros servicios y atención al cliente.</li>
              <li>Cumplir con obligaciones legales y regulatorias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Compartir información con terceros</h2>
            <p>
              No vendemos, alquilamos ni compartimos su información personal con terceros no afiliados,
              excepto para facilitar la prestación de nuestros servicios (por ejemplo, proporcionar su número
              de teléfono y dirección a los repartidores asignados a su pedido) o cuando la ley lo exija.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Integración con WhatsApp API</h2>
            <p>
              Nuestro servicio utiliza la API oficial de WhatsApp para enviarle notificaciones transaccionales. 
              Al usar nuestro servicio, usted acepta recibir estos mensajes automatizados. Los mensajes están
              sujetos a las políticas de privacidad y términos de servicio de Meta Platforms, Inc.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Seguridad de los datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal 
              contra el acceso no autorizado, la pérdida o la alteración. Sus datos se procesan a través de canales 
              seguros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contacto</h2>
            <p>
              Si tiene alguna pregunta o inquietud sobre nuestra Política de Privacidad o el manejo de sus datos,
              por favor contáctenos a través de nuestros canales oficiales de atención al cliente.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
