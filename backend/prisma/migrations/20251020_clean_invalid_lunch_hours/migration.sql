-- Migration: Limpar horários de almoço inválidos/vazios
-- Descrição: Define horários de almoço como NULL quando estão vazios ou inválidos

UPDATE business_hours
SET 
  "mondayLunchStart" = NULL,
  "mondayLunchEnd" = NULL,
  "tuesdayLunchStart" = NULL,
  "tuesdayLunchEnd" = NULL,
  "wednesdayLunchStart" = NULL,
  "wednesdayLunchEnd" = NULL,
  "thursdayLunchStart" = NULL,
  "thursdayLunchEnd" = NULL,
  "fridayLunchStart" = NULL,
  "fridayLunchEnd" = NULL,
  "saturdayLunchStart" = NULL,
  "saturdayLunchEnd" = NULL,
  "sundayLunchStart" = NULL,
  "sundayLunchEnd" = NULL,
  "updatedAt" = NOW()
WHERE 
  -- Limpar se estiver vazio string
  ("mondayLunchStart" = '' OR "mondayLunchEnd" = '' OR
   "tuesdayLunchStart" = '' OR "tuesdayLunchEnd" = '' OR
   "wednesdayLunchStart" = '' OR "wednesdayLunchEnd" = '' OR
   "thursdayLunchStart" = '' OR "thursdayLunchEnd" = '' OR
   "fridayLunchStart" = '' OR "fridayLunchEnd" = '' OR
   "saturdayLunchStart" = '' OR "saturdayLunchEnd" = '' OR
   "sundayLunchStart" = '' OR "sundayLunchEnd" = '')
  OR
  -- Limpar se almoço começa antes do horário de início (inválido)
  ("mondayLunchStart" IS NOT NULL AND "mondayStart" IS NOT NULL AND "mondayLunchStart" < "mondayStart") OR
  ("tuesdayLunchStart" IS NOT NULL AND "tuesdayStart" IS NOT NULL AND "tuesdayLunchStart" < "tuesdayStart") OR
  ("wednesdayLunchStart" IS NOT NULL AND "wednesdayStart" IS NOT NULL AND "wednesdayLunchStart" < "wednesdayStart") OR
  ("thursdayLunchStart" IS NOT NULL AND "thursdayStart" IS NOT NULL AND "thursdayLunchStart" < "thursdayStart") OR
  ("fridayLunchStart" IS NOT NULL AND "fridayStart" IS NOT NULL AND "fridayLunchStart" < "fridayStart") OR
  ("saturdayLunchStart" IS NOT NULL AND "saturdayStart" IS NOT NULL AND "saturdayLunchStart" < "saturdayStart") OR
  ("sundayLunchStart" IS NOT NULL AND "sundayStart" IS NOT NULL AND "sundayLunchStart" < "sundayStart");

-- Também limpar casos onde apenas um dos dois (início ou fim do almoço) está preenchido
UPDATE business_hours
SET 
  "mondayLunchStart" = NULL,
  "mondayLunchEnd" = NULL,
  "tuesdayLunchStart" = NULL,
  "tuesdayLunchEnd" = NULL,
  "wednesdayLunchStart" = NULL,
  "wednesdayLunchEnd" = NULL,
  "thursdayLunchStart" = NULL,
  "thursdayLunchEnd" = NULL,
  "fridayLunchStart" = NULL,
  "fridayLunchEnd" = NULL,
  "saturdayLunchStart" = NULL,
  "saturdayLunchEnd" = NULL,
  "sundayLunchStart" = NULL,
  "sundayLunchEnd" = NULL,
  "updatedAt" = NOW()
WHERE 
  ("mondayLunchStart" IS NULL AND "mondayLunchEnd" IS NOT NULL) OR
  ("mondayLunchStart" IS NOT NULL AND "mondayLunchEnd" IS NULL) OR
  ("tuesdayLunchStart" IS NULL AND "tuesdayLunchEnd" IS NOT NULL) OR
  ("tuesdayLunchStart" IS NOT NULL AND "tuesdayLunchEnd" IS NULL) OR
  ("wednesdayLunchStart" IS NULL AND "wednesdayLunchEnd" IS NOT NULL) OR
  ("wednesdayLunchStart" IS NOT NULL AND "wednesdayLunchEnd" IS NULL) OR
  ("thursdayLunchStart" IS NULL AND "thursdayLunchEnd" IS NOT NULL) OR
  ("thursdayLunchStart" IS NOT NULL AND "thursdayLunchEnd" IS NULL) OR
  ("fridayLunchStart" IS NULL AND "fridayLunchEnd" IS NOT NULL) OR
  ("fridayLunchStart" IS NOT NULL AND "fridayLunchEnd" IS NULL) OR
  ("saturdayLunchStart" IS NULL AND "saturdayLunchEnd" IS NOT NULL) OR
  ("saturdayLunchStart" IS NOT NULL AND "saturdayLunchEnd" IS NULL) OR
  ("sundayLunchStart" IS NULL AND "sundayLunchEnd" IS NOT NULL) OR
  ("sundayLunchStart" IS NOT NULL AND "sundayLunchEnd" IS NULL);
