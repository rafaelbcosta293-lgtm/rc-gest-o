-- Novo papel "Comercial" (leads, contactos, experimentais, vendas) —
-- pedido pela especificação do CRM. Aditivo: não mexe em nenhuma conta
-- existente, só passa a ser uma opção possível no dropdown de Equipa.
alter type papel_utilizador add value 'comercial';
