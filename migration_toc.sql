-- ========================================
-- 교회 계간지 - 목차 데이터 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- 1. category 컬럼 제거
ALTER TABLE chapters DROP COLUMN IF EXISTS category;

-- 2. 기존 chapters 데이터 삭제 (있으면)
DELETE FROM chapters;

-- 3. 목차 17개 항목 삽입
INSERT INTO chapters (order_number, chapter_code, title, writer_id, status) VALUES
  (1,  '1',   '새물결 뉴우스',                    NULL, 'draft'),
  (2,  '2',   '내일을 향한 기도 (1월~3월)',         NULL, 'draft'),
  (3,  '3-1', '창간호 축하 인사 - 이정철 목사님',    NULL, 'draft'),
  (4,  '3-2', '창간호 축하 인사 - 김상배 장로님',    NULL, 'draft'),
  (5,  '3-3', '창간호 축하 인사 - 이성진 집사님',    NULL, 'draft'),
  (6,  '4-1', '청년부 새내기 소개 - 신아인',        NULL, 'draft'),
  (7,  '4-2', '청년부 새내기 소개 - 김지은',        NULL, 'draft'),
  (8,  '4-3', '청년부 새내기 소개 - 한명더',        NULL, 'draft'),
  (9,  '5',   '신앙의 사계 - 봄의 사순절/부활절',    NULL, 'draft'),
  (10, '6-1', '부서 탐방 - 유치부',               NULL, 'draft'),
  (11, '6-2', '부서 탐방 - 유초등부',             NULL, 'draft'),
  (12, '7',   '나의 교회 새물결 삼행시 대회',       NULL, 'draft'),
  (13, '8',   '아시나요?',                       NULL, 'draft'),
  (14, '9-1', '교우 일터 - 친구랑 학습센터',        NULL, 'draft'),
  (15, '9-2', '교우 일터 - 러닝 플래닛',           NULL, 'draft'),
  (16, '10',  '여기 어때? - 신규 점포/맛집 소개',    NULL, 'draft'),
  (17, '11',  '어서와, 캄보디아',                  NULL, 'draft');

-- 확인
SELECT order_number, chapter_code, title, status FROM chapters ORDER BY order_number;

-- ========================================
-- 4. schedules 테이블 생성 (제작 타임라인)
-- ========================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  order_number INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 제작 일정 3개 (관리자가 날짜 수정 가능)
INSERT INTO schedules (order_number, title, due_date, completed) VALUES
  (1, '원고 마감',    '2026-02-22', false),
  (2, '인쇄소 전달',  '2026-03-06', false),
  (3, '출간 목표',    '2026-03-15', false);

SELECT * FROM schedules ORDER BY order_number;

-- ========================================
-- 5. chapters 테이블에 submitted_at 컬럼 추가
-- ========================================
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- ========================================
-- 6. chapters 테이블에 reviewed_by, reviewed_at 컬럼 추가
-- (교정완료 → 관리자 확정 워크플로우)
-- ========================================
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
