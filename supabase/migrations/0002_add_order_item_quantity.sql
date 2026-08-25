-- Lets a customer order more than one of the same dish/options combo per day.
alter table order_items add column quantity int not null default 1;
