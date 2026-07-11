import type { Dispatch, SetStateAction } from "react";

import type { FormState, ModalMode } from "../types";
import { useKakaoMapLocation } from "../hooks/useKakaoMapLocation";
import { Input } from "../../../../common/input";

import styles from "./EventModal.module.css";

type EventLocationPickerProps = {
  mode: ModalMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  mapOpen: boolean;
  setMapOpen: Dispatch<SetStateAction<boolean>>;
  setFormError: (message: string) => void;
};

// 일정에 연결할 장소 검색과 선택 위치 정보 관리
export function EventLocationPicker({
  mode,
  form,
  setForm,
  mapOpen,
  setMapOpen,
  setFormError,
}: EventLocationPickerProps) {
  const {
    mapRef,
    placeKeyword,
    setPlaceKeyword,
    searchResults,
    isSearching,
    searchPlaces,
    openInNaverMap,
    handleSelectPlace,
    clearLocation,
  } = useKakaoMapLocation({
    mode,
    form,
    setForm,
    mapOpen,
    setFormError,
  });

  // 접힌 상태에서 보여줄 지도 요약 문구
  const mapSummary = form.locationName?.trim()
    ? form.locationName
    : form.locationAddress?.trim()
    ? "위치 선택됨"
    : "선택된 위치 없음";
  // 실제 위치 정보가 있을 때만 위치 정보 박스 표시
  const hasLocationInfo = !!(
    form.locationAddress ||
    form.locationLat != null ||
    form.locationLng != null
  );

  return (
    <>
      {hasLocationInfo && (
        <div className={styles.placeInfoBox}>
          <div className={styles.placeInfoTitle}>{form.locationName || "선택한 장소"}</div>

          {form.locationAddress && (
            <div className={styles.placeInfoAddress}>{form.locationAddress}</div>
          )}

        </div>
      )}

      <div
        className={styles.sectionRow}
        onClick={() => {
          setMapOpen((prev) => !prev);
        }}
      >
        <div className={styles.sectionTitle}>지도</div>

        <div className={styles.sectionRight}>
          <span className={styles.sectionSummary}>{mapSummary}</span>
          <span className={styles.sectionArrow}>{mapOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      <div className={`${styles.collapsible} ${mapOpen ? styles.collapsibleOpen : ""}`}>
        <div className={`${styles.sectionGrid} ${styles.collapsibleInner}`}>
          <div className={styles.placeSearchRow}>
            <Input
              type="text"
              value={placeKeyword}
              onChange={(e) => setPlaceKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchPlaces();
                }
              }}
              placeholder="장소명을 입력해주세요."
            />

            <button type="button" className={styles.placeSearchBtn} onClick={searchPlaces}>
              검색
            </button>

            <button type="button" className={styles.naverMapBtn} onClick={openInNaverMap}>
              N
            </button>
          </div>

          {isSearching && <div className={styles.placeSearchHint}>검색 중...</div>}

          {searchResults.length > 0 && (
            <div className={styles.placeResultList}>
              {searchResults.map((place, idx) => (
                <button
                  key={`${place.id ?? place.place_name}-${idx}`}
                  type="button"
                  className={styles.placeResultItem}
                  onClick={() => handleSelectPlace(place)}
                >
                  <div className={styles.placeResultName}>{place.place_name}</div>
                  <div className={styles.placeResultAddress}>
                    {place.road_address_name || place.address_name || "주소 정보 없음"}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div ref={mapRef} className={styles.kakaoMap}></div>

          <div className={styles.mapCoordActions}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={(e) => {
                e.stopPropagation();
                clearLocation();
              }}
            >
              위치 초기화
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
