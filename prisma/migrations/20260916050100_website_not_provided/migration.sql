-- "Sem site" e "só rede social" eram deduzidos da falta do campo na fonte, o
-- que não prova que a empresa não tem site. Passam a "site não informado".
UPDATE "Lead" SET "websiteStatus" = 'NOT_PROVIDED' WHERE "websiteStatus" IN ('NO_WEBSITE', 'SOCIAL_ONLY');
