import React, { useEffect, useRef, useState } from 'react';
import { RoutePoint, TripDetails, CarData, OptimizedRouteResult } from '../types';
import { ZoomInIcon, ZoomOutIcon, LocateIcon, RouteOptimizeIcon, CloseIcon } from './icons';
import { getOptimizedRoute } from '../services/geminiService';


interface RouteMapProps {
    routeHistory: RoutePoint[];
    tripDetails: TripDetails[];
    currentLocation: GeolocationCoordinates | null;
    carData: CarData;
}

const RouteMap: React.FC<RouteMapProps> = ({ routeHistory, tripDetails, currentLocation, carData }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any | null>(null); // Using any for L.Map to avoid type issues with Leaflet global
    const animationFrameRef = useRef<number | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    
    // State for optimization
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizedResult, setOptimizedResult] = useState<OptimizedRouteResult | null>(null);

    // Check if Leaflet and GeoSearch are loaded
    const L = (window as any).L;
    const GeoSearch = (window as any).GeoSearch;

    useEffect(() => {
        if (!L || !GeoSearch || !mapContainerRef.current) return;
        if (mapRef.current) return; // Map already initialized

        const map = L.map(mapContainerRef.current, {
            zoomControl: false, // Disable default zoom control
        }).setView([37.78, -122.41], 13);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        
        const provider = new GeoSearch.OpenStreetMapProvider();
        const searchControl = new GeoSearch.GeoSearchControl({
            provider,
            style: 'bar',
            showMarker: true,
            showPopup: false,
            autoClose: true,
            retainZoomLevel: false,
            animateZoom: true,
            keepResult: true,
            searchLabel: 'Search places...'
        });
        map.addControl(searchControl);

        mapRef.current = map;
        setIsMapReady(true);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [L, GeoSearch]);

    useEffect(() => {
        if (!mapRef.current || !isMapReady) return;

        const map = mapRef.current;

        // Clear previous animation if running
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        // Clear previous vector layers (markers, polylines)
        map.eachLayer((layer: any) => {
            if (!!layer.toGeoJSON) {
                map.removeLayer(layer);
            }
        });

        // Animate route history
        if (routeHistory.length > 1) {
            const latLngs = routeHistory.map(p => L.latLng(p.lat, p.lng));
            map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 15 });

            const animatedPolyline = L.polyline([], { color: '#0075FF', weight: 4 }).addTo(map);
            
            const animationDuration = 1500; // 1.5 seconds
            let startTime: number | null = null;
            let currentPointIndex = 0;

            const animateLine = (timestamp: number) => {
                if (startTime === null) {
                    startTime = timestamp;
                }
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);

                const targetPointIndex = Math.floor(progress * (routeHistory.length - 1));

                if (targetPointIndex >= currentPointIndex) {
                    const pointsToAdd = routeHistory.slice(currentPointIndex, targetPointIndex + 1).map(p => L.latLng(p.lat, p.lng));
                    if (pointsToAdd.length > 0) {
                        for (const point of pointsToAdd) {
                            animatedPolyline.addLatLng(point);
                        }
                    }
                    currentPointIndex = targetPointIndex + 1;
                }

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animateLine);
                }
            };
            
            animationFrameRef.current = requestAnimationFrame(animateLine);
        }

        // Draw optimized route if available
        if (optimizedResult) {
            const optimizedLatLngs = optimizedResult.optimizedRoute.map(p => [p.lat, p.lng]);
            L.polyline(optimizedLatLngs, { color: '#10B981', weight: 4, dashArray: '5, 5', pane: 'overlayPane' }).addTo(map);
        }

        // Add trip detail markers
        tripDetails.forEach(trip => {
            const point = routeHistory[trip.pointIndex];
            if (point) {
                L.marker([point.lat, point.lng]).addTo(map).bindPopup(`<b>${trip.title}</b><br>${trip.details}`);
            }
        });

        // Add current location marker
        if (currentLocation) {
             const carIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color:#0075FF;width:16px;height:16px;border-radius:50%;border:2px solid white;"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            L.marker([currentLocation.latitude, currentLocation.longitude], {icon: carIcon}).addTo(map).bindPopup('Current Location');
        }

        return () => {
             if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }

    }, [isMapReady, routeHistory, tripDetails, currentLocation, L, optimizedResult]);
    
    const handleOptimizeRoute = async () => {
        if (!routeHistory || routeHistory.length < 2) return;
        setIsOptimizing(true);
        setOptimizedResult(null);
        try {
            const result = await getOptimizedRoute(routeHistory, carData);
            setOptimizedResult(result);
        } catch (error) {
            console.error("Failed to optimize route:", error);
            alert("Sorry, we couldn't optimize the route at this time.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleZoomIn = () => mapRef.current?.zoomIn();
    const handleZoomOut = () => mapRef.current?.zoomOut();
    const handleCenter = () => {
        if (mapRef.current && currentLocation) {
            mapRef.current.setView([currentLocation.latitude, currentLocation.longitude], 15);
        }
    };

    if (!L || !GeoSearch) {
        return <div className="relative w-full h-96 bg-brand-dark rounded-lg flex items-center justify-center"><p className="text-brand-gray">Loading map libraries...</p></div>;
    }
    
    return (
        <div className="relative w-full h-96 rounded-lg overflow-hidden border border-gray-700">
            <div ref={mapContainerRef} className="w-full h-full" />
            <div className="absolute top-3 right-3 flex flex-col space-y-2 z-[1000]">
                <button onClick={handleZoomIn} className="bg-brand-dark-2 p-2 rounded-md text-white hover:bg-gray-700 transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
                <button onClick={handleZoomOut} className="bg-brand-dark-2 p-2 rounded-md text-white hover:bg-gray-700 transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
                <button onClick={handleCenter} className="bg-brand-dark-2 p-2 rounded-md text-white hover:bg-gray-700 transition-colors" disabled={!currentLocation}><LocateIcon className="w-5 h-5" /></button>
                <button onClick={handleOptimizeRoute} className="bg-brand-dark-2 p-2 rounded-md text-white hover:bg-gray-700 transition-colors" disabled={isOptimizing}>
                    {isOptimizing ? <div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div> : <RouteOptimizeIcon className="w-5 h-5" />}
                </button>
            </div>
            {optimizedResult && (
                <div className="absolute bottom-0 left-0 right-0 bg-brand-dark-2/80 backdrop-blur-sm p-4 z-[1000] border-t border-gray-700">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-white">AI Route Optimization</h4>
                            <div className="flex items-center gap-4 text-sm mt-1">
                                <p><span className="font-semibold text-green-400">Time Saved:</span> {optimizedResult.timeSavedMinutes} min</p>
                                <p><span className="font-semibold text-green-400">{carData.make === 'Tesla' ? 'Energy' : 'Fuel'} Saved:</span> {optimizedResult.energySavedPercent}%</p>
                            </div>
                        </div>
                        <button onClick={() => setOptimizedResult(null)} className="text-gray-400 hover:text-white transition-colors">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteMap;