import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  KakaoAddressSearchResult,
  KakaoGeocoder,
  KakaoMap,
  KakaoMapMouseEvent,
  KakaoMarker,
  KakaoPlaceSearchResult,
  KakaoPlaces,
  KakaoServiceStatus,
} from "../../../../global";
import type { FormState, ModalMode } from "../types";

type UseKakaoMapLocationArgs = {
  mode: ModalMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  mapOpen: boolean;
  setFormError: (message: string) => void;
};

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

export function useKakaoMapLocation({
  mode,
  form,
  setForm,
  mapOpen,
  setFormError,
}: UseKakaoMapLocationArgs) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<KakaoMap | null>(null);
  const markerRef = useRef<KakaoMarker | null>(null);
  const placesRef = useRef<KakaoPlaces | null>(null);
  const geocoderRef = useRef<KakaoGeocoder | null>(null);

  const [placeKeyword, setPlaceKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<KakaoPlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const moveMarkerTo = (lat: number, lng: number) => {
    if (!mapInstance.current || !window.kakao?.maps) return;

    const position = new window.kakao.maps.LatLng(lat, lng);

    if (!markerRef.current) {
      markerRef.current = new window.kakao.maps.Marker({
        position,
      });
      markerRef.current.setMap(mapInstance.current);
    } else {
      markerRef.current.setPosition(position);
    }

    mapInstance.current.setCenter(position);
  };

  const reverseGeocode = (lat: number, lng: number, placeName?: string) => {
    const kakaoMaps = window.kakao?.maps;
    if (!geocoderRef.current || !kakaoMaps) return;

    geocoderRef.current.coord2Address(lng, lat, (result: KakaoAddressSearchResult[], status: KakaoServiceStatus) => {
      const ok = status === kakaoMaps.services.Status.OK;

      const address =
        ok && result?.[0]
          ? result[0].road_address?.address_name || result[0].address?.address_name || ""
          : "";

      const nextName = (placeName && placeName.trim()) || address || "선택한 위치";

      setForm((p) => ({
        ...p,
        locationName: nextName,
        locationAddress: address,
        locationLat: lat,
        locationLng: lng,
      }));

      setPlaceKeyword(nextName);
    });
  };

  const applyLocation = (lat: number, lng: number, placeName: string, address?: string) => {
    moveMarkerTo(lat, lng);

    if (address && address.trim()) {
      setForm((p) => ({
        ...p,
        locationName: placeName,
        locationAddress: address,
        locationLat: lat,
        locationLng: lng,
      }));
    } else {
      reverseGeocode(lat, lng, placeName);
    }
  };

  const initMap = () => {
    if (!mapRef.current || !window.kakao?.maps) return;

    const lat = form.locationLat ?? 37.5665;
    const lng = form.locationLng ?? 126.978;
    const center = new window.kakao.maps.LatLng(lat, lng);

    const map = new window.kakao.maps.Map(mapRef.current, {
      center,
      level: 3,
    });

    mapInstance.current = map;
    placesRef.current = new window.kakao.maps.services.Places();
    geocoderRef.current = new window.kakao.maps.services.Geocoder();

    if (form.locationLat != null && form.locationLng != null) {
      const marker = new window.kakao.maps.Marker({
        position: center,
      });
      marker.setMap(map);
      markerRef.current = marker;
    } else {
      markerRef.current = null;
    }

    window.kakao.maps.event.addListener(map, "click", (mouseEvent: KakaoMapMouseEvent) => {
      const latlng = mouseEvent.latLng;
      const nextLat = latlng.getLat();
      const nextLng = latlng.getLng();

      moveMarkerTo(nextLat, nextLng);
      reverseGeocode(nextLat, nextLng);
    });

    setTimeout(() => {
      map.relayout();
      map.setCenter(center);
    }, 0);
  };

  const searchPlaces = () => {
    const keyword = placeKeyword.trim();

    if (!keyword) {
      setSearchResults([]);
      return;
    }

    const kakaoMaps = window.kakao?.maps;
    if (!placesRef.current || !kakaoMaps) return;

    setIsSearching(true);

    placesRef.current.keywordSearch(keyword, (data: KakaoPlaceSearchResult[], status: KakaoServiceStatus) => {
      setIsSearching(false);

      if (status === kakaoMaps.services.Status.OK) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    });
  };

  const openInNaverMap = () => {
    const keyword =
      form.locationName?.trim() || form.locationAddress?.trim() || placeKeyword.trim();

    if (!keyword) {
      setFormError("먼저 장소를 검색하거나 지도에서 위치를 선택해주세요.");
      return;
    }

    const url = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSelectPlace = (place: KakaoPlaceSearchResult) => {
    const lat = Number(place.y);
    const lng = Number(place.x);

    applyLocation(
      lat,
      lng,
      place.place_name ?? "",
      place.road_address_name || place.address_name || ""
    );

    setPlaceKeyword(place.place_name ?? "");
    setSearchResults([]);
  };

  const clearLocation = () => {
    setForm((p) => ({
      ...p,
      locationName: "",
      locationAddress: "",
      locationLat: null,
      locationLng: null,
    }));

    setPlaceKeyword("");
    setSearchResults([]);

    markerRef.current?.setMap?.(null);
    markerRef.current = null;

    if (mapInstance.current && window.kakao?.maps) {
      const center = new window.kakao.maps.LatLng(37.5665, 126.978);
      mapInstance.current.setCenter(center);
    }
  };

  useEffect(() => {
    if (mode === "none") return;
    if (!mapOpen) return;

    if (!KAKAO_MAP_KEY) {
      console.error("VITE_KAKAO_MAP_JS_KEY is missing");
      return;
    }

    const bootMap = () => {
      if (!window.kakao?.maps) return;

      window.kakao.maps.load(() => {
        initMap();
      });
    };

    if (window.kakao?.maps) {
      bootMap();
      return;
    }

    const existingScript = document.querySelector(
      'script[data-kakao-map="true"]'
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", bootMap);
      return () => {
        existingScript.removeEventListener("load", bootMap);
      };
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.async = true;
    script.setAttribute("data-kakao-map", "true");

    script.onload = () => {
      bootMap();
    };

    script.onerror = (e) => {
      console.error("[kakao sdk] load error", e);
    };

    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  // Kakao SDK 로딩 흐름에서만 초기화해야 해서 initMap 의존성은 고정한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, mapOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPlaceKeyword(form.locationName || "");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [form.locationName]);

  useEffect(() => {
    if (!mapOpen) return;
    const map = mapInstance.current;
    const kakaoMaps = window.kakao?.maps;
    if (!map || !kakaoMaps) return;

    setTimeout(() => {
      map.relayout();

      const lat = form.locationLat ?? 37.5665;
      const lng = form.locationLng ?? 126.978;
      const center = new kakaoMaps.LatLng(lat, lng);
      map.setCenter(center);
    }, 0);
  }, [mapOpen, form.locationLat, form.locationLng]);

  return {
    mapRef,
    placeKeyword,
    setPlaceKeyword,
    searchResults,
    isSearching,
    searchPlaces,
    openInNaverMap,
    handleSelectPlace,
    clearLocation,
  };
}
