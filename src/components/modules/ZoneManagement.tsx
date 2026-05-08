import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { Map, Trash2, CheckCircle, XCircle, MousePointerClick, Save } from 'lucide-react';
import { DeliveryZone } from '../../types';
import { getAllZones, createZone, updateZone, deleteZone } from '../../lib/zoneSync';

const libraries: ("geometry" | "places")[] = ['places', 'geometry'];

const mapContainerStyle = {
    width: '100%',
    height: '500px'
};

const center = {
    lat: 19.7046,
    lng: -103.4617
};

export default function ZoneManagement() {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries
    });

    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [draftPolygon, setDraftPolygon] = useState<{ lat: number, lng: number }[]>([]);
    const [newZoneForm, setNewZoneForm] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftCommission, setDraftCommission] = useState<number>(35);

    const loadZones = async () => {
        setLoading(true);
        try {
            const data = await getAllZones();
            setZones(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadZones();
    }, []);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!isDrawingMode || !e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setDraftPolygon(prev => [...prev, { lat, lng }]);
    }, [isDrawingMode]);

    const handleFinishDrawing = () => {
        if (draftPolygon.length < 3) {
            alert('Un polígono debe tener al menos 3 puntos.');
            return;
        }
        setIsDrawingMode(false);
        setNewZoneForm(true);
    };

    const handleSaveDraft = async () => {
        if (draftPolygon.length < 3 || !draftName) return;

        try {
            await createZone({
                name: draftName,
                commission: draftCommission,
                polygon: draftPolygon,
                is_active: true
            });
            setDraftPolygon([]);
            setNewZoneForm(false);
            setDraftName('');
            setDraftCommission(35);

            loadZones();
        } catch (err) {
            console.error(err);
        }
    };

    const handleCancelDraft = () => {
        setDraftPolygon([]);
        setIsDrawingMode(false);
        setNewZoneForm(false);
        setDraftName('');
        setDraftCommission(35);
    };

    const toggleZoneActive = async (zone: DeliveryZone) => {
        try {
            await updateZone(zone.id, { is_active: !zone.is_active });
            loadZones();
        } catch (err) { }
    };

    const removeZone = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta zona?')) return;
        try {
            await deleteZone(id);
            loadZones();
        } catch (err) { }
    };

    return (
        <div className="p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Map className="w-6 h-6 text-blue-600" />
                        Zonas de Entrega
                    </h1>
                    <p className="text-gray-600 mt-1">Configura los polígonos de entrega y sus comisiones</p>
                </div>
                {!isDrawingMode && !newZoneForm && (
                    <button
                        onClick={() => { setIsDrawingMode(true); setDraftPolygon([]); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                        <MousePointerClick className="w-5 h-5" />
                        Crear Nueva Zona
                    </button>
                )}
                {isDrawingMode && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md animate-pulse font-medium">
                            Haz clic en el mapa para trazar los puntos... ({draftPolygon.length})
                        </span>
                        <button
                            onClick={handleFinishDrawing}
                            disabled={draftPolygon.length < 3}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            Finalizar Zona
                        </button>
                        <button
                            onClick={handleCancelDraft}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                        >
                            Cancelar
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        {isLoaded ? (
                            <GoogleMap
                                mapContainerStyle={mapContainerStyle}
                                center={center}
                                zoom={14}
                                onClick={handleMapClick}
                                options={{
                                    draggableCursor: isDrawingMode ? 'crosshair' : 'grab'
                                }}
                            >
                                {/* Draft Polygon manually being drawn */}
                                {draftPolygon.length > 0 && (
                                    <Polygon
                                        paths={draftPolygon}
                                        options={{
                                            fillColor: '#3b82f6',
                                            fillOpacity: 0.4,
                                            strokeColor: '#2563eb',
                                            strokeWeight: 2,
                                            editable: false
                                        }}
                                    />
                                )}

                                {zones.map(z => (
                                    <Polygon
                                        key={z.id}
                                        paths={z.polygon}
                                        options={{
                                            fillColor: z.is_active ? '#10b981' : '#9ca3af',
                                            fillOpacity: 0.3,
                                            strokeColor: z.is_active ? '#059669' : '#6b7280',
                                            strokeWeight: 2,
                                            clickable: false
                                        }}
                                    />
                                ))}
                            </GoogleMap>
                        ) : (
                            <div className="w-full h-[500px] bg-gray-100 flex items-center justify-center rounded-lg">
                                Cargando mapa...
                            </div>
                        )}

                        {newZoneForm && (
                            <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                <h3 className="font-semibold text-blue-900 mb-3">Guardar Nueva Zona</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Zona</label>
                                        <input
                                            type="text"
                                            value={draftName}
                                            onChange={e => setDraftName(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ej. Zona Centro"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Comisión (MXN)</label>
                                        <input
                                            type="number"
                                            value={draftCommission}
                                            onChange={e => setDraftCommission(Number(e.target.value))}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <button onClick={handleSaveDraft} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                                    <button onClick={handleCancelDraft} className="px-4 py-2 border bg-white rounded hover:bg-gray-50">Cancelar</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h2 className="font-semibold text-gray-900 mb-4 border-b pb-2">Zonas Configuradas</h2>
                    {loading ? (
                        <p className="text-gray-500 text-sm">Cargando...</p>
                    ) : zones.length === 0 ? (
                        <p className="text-gray-500 text-sm">No hay zonas configuradas. Usa el mapa para dibujar una.</p>
                    ) : (
                        <ul className="space-y-3">
                            {zones.map(z => (
                                <li key={z.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{z.name}</span>
                                            {z.is_active ?
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Activa</span> :
                                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactiva</span>
                                            }
                                        </div>
                                        <p className="text-sm text-gray-600">${z.commission} MXN</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => toggleZoneActive(z)}
                                            title={z.is_active ? "Desactivar" : "Activar"}
                                            className={`p-1.5 rounded-md hover:bg-gray-200 ${z.is_active ? 'text-green-600' : 'text-gray-400'}`}
                                        >
                                            {z.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => removeZone(z.id)}
                                            title="Eliminar"
                                            className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
