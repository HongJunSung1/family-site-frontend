export {};

export type KakaoServiceStatus = string;

type KakaoMapOptions = {
  center: KakaoLatLng;
  level: number;
};

type KakaoMarkerOptions = {
  position: KakaoLatLng;
};

type KakaoAddressInfo = {
  address_name?: string;
};

export type KakaoAddressSearchResult = {
  road_address?: KakaoAddressInfo | null;
  address?: KakaoAddressInfo | null;
};

export type KakaoPlaceSearchResult = {
  id?: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x: string;
  y: string;
};

export type KakaoMapMouseEvent = {
  latLng: KakaoLatLng;
};

export type KakaoLatLng = {
  getLat(): number;
  getLng(): number;
};

export type KakaoMap = {
  setCenter(position: KakaoLatLng): void;
  relayout(): void;
};

export type KakaoMarker = {
  setMap(map: KakaoMap | null): void;
  setPosition(position: KakaoLatLng): void;
};

export type KakaoPlaces = {
  keywordSearch(
    keyword: string,
    callback: (data: KakaoPlaceSearchResult[], status: KakaoServiceStatus) => void
  ): void;
};

export type KakaoGeocoder = {
  coord2Address(
    lng: number,
    lat: number,
    callback: (result: KakaoAddressSearchResult[], status: KakaoServiceStatus) => void
  ): void;
};

type KakaoSdk = {
  maps: {
    load(callback: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
    Marker: new (options: KakaoMarkerOptions) => KakaoMarker;
    event: {
      addListener(
        target: KakaoMap,
        eventName: "click",
        handler: (mouseEvent: KakaoMapMouseEvent) => void
      ): void;
    };
    services: {
      Status: {
        OK: KakaoServiceStatus;
      };
      Places: new () => KakaoPlaces;
      Geocoder: new () => KakaoGeocoder;
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoSdk;
  }
}
