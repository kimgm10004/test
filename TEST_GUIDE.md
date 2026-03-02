# 도트 경마 테스트 가이드

## 테스트 실행 방법

### 필수 설치
```bash
cd v2_files_완성
npm install
```

### 테스트 실행
```bash
# 개발 모드 (파일 변경 시 자동 재실행)
npm run test

# 단일 실행
npm run test:run

# 커버리지 리포트 생성
npm run test:coverage

# UI 모드
npm run test:ui
```

## 테스트 파일 구조

```
v2_files_완성/
├── tests/
│   ├── setup.js              # 테스트 설정
│   ├── storage-manager.test.js  # 저장소 관리자 테스트
│   └── ...
├── vitest.config.js          # Vitest 설정
└── package.json
```

## 테스트 작성 가이드

### 기본 구조
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('모듈명', () => {
  beforeEach(() => {
    // 각 테스트 전 실행
  });

  it('테스트 설명', () => {
    expect(actual).toBe(expected);
  });
});
```

### 주요 매처
- `toBe(value)` - 일치 여부
- `toEqual(object)` - 객체 비교
- `toBeTruthy()` - 진리값
- `toBeNull()` - null 여부
- `toHaveBeenCalled()` - 함수 호출 여부

## 커버리지 목표

- 현재: 0%
- 목표: 60% (1단계)

## 우선 테스트 대상

1. **StorageManager** - 데이터 저장/로드
2. **MathUtils** - 수학 유틸리티
3. **PhysicsEngine** - 물리 엔진
4. **데이터 모델** - 시즌, 통계, NFT
