ALTER TABLE pos_sale_lines ADD COLUMN list_unit_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (list_unit_price >= 0);
ALTER TABLE pos_sale_lines ADD COLUMN discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent < 100);
UPDATE pos_sale_lines SET list_unit_price=unit_price;
