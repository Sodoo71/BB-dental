-- BB Dental demo data, PostgreSQL. Apply all Prisma migrations first.
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/demo-data.sql
-- Demo/test databases only: all five demo accounts use password Demo1234!
-- Admin: 99009001; reception: 99009002; doctors: 99009101..99009103.
-- Patients and phone numbers are fictional. No external notifications are sent.
-- Atomic and repeatable: an existing completion marker skips the entire seed.
-- Existing records are never updated/deleted; unique conflicts roll back the seed.

BEGIN;
SET LOCAL TIME ZONE 'UTC';
SELECT pg_advisory_xact_lock(hashtext('bb-dental-demo-v1'));

-- Temporary helper produces UUID v4-shaped IDs accepted by application validation.
CREATE OR REPLACE FUNCTION pg_temp.demo_id(kind integer, n integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'bbde0000-0000-4000-8000-' || lpad(kind::text, 4, '0') || lpad(n::text, 8, '0');
$$;

DO $$
DECLARE
  base_date date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ulaanbaatar')::date;
  password_hash text := '$2b$12$Tkga25l8CCMGWpLrU0j6YeTeDB75cAEZNnb66.A64Gciyu5Pm7KzS';
  names text[] := ARRAY['Анужин','Тэмүүлэн','Номин','Билгүүн','Марал','Тэнүүн','Саруул','Энхжин','Хулан','Төгөлдөр'];
  surnames text[] := ARRAY['Бат','Дорж','Энх','Болд','Ган','Сүх'];
  services text[] := ARRAY['Анхан үзлэг','Шүдний чулуу цэвэрлэх','Шүдний ломбо','Сувгийн эмчилгээ','Шүд авах','Шүд цайруулах','Хүүхдийн үзлэг','Фтор түрхэх'];
  prices integer[] := ARRAY[30000,90000,120000,250000,80000,350000,25000,40000];
  doctor_names text[] := ARRAY['Б. Энхтуяа','Д. Батбаяр','С. Номин'];
  admin_id text := pg_temp.demo_id(1, 1);
  reception_id text := pg_temp.demo_id(1, 2);
  i integer; d integer; slot integer; day_offset integer; k integer := 0;
  patient_no integer; service_no integer; amount_due integer; paid integer;
  appt_id text; patient_id text; doctor_id text; service_id text; treatment_id text; invoice_id text;
  appt_status "AppointmentStatus"; appt_date date; start_time text; event_at timestamp;
  payment_method "PaymentMethod";
BEGIN
  IF EXISTS (SELECT 1 FROM "Setting" WHERE key = 'demoSeed.v1') THEN
    RAISE NOTICE 'Demo data already exists; skipped.';
    RETURN;
  END IF;

  INSERT INTO "User" (id,name,phone,"passwordHash",role,"approvalStatus","approvedAt") VALUES
    (admin_id,'Демо Админ','99009001',password_hash,'ADMIN','APPROVED',now()),
    (reception_id,'Демо Ресепшн','99009002',password_hash,'RECEPTION','APPROVED',now());

  FOR d IN 1..3 LOOP
    doctor_id := pg_temp.demo_id(2, d);
    INSERT INTO "User" (id,name,phone,"passwordHash",role,"approvalStatus","approvedAt","approvedById")
    VALUES (pg_temp.demo_id(1,100+d),doctor_names[d],(99009100+d)::text,password_hash,'DOCTOR','APPROVED',now(),admin_id);
    INSERT INTO "Doctor" (id,"userId",name,specialty,bio,"sortOrder")
    VALUES (doctor_id,pg_temp.demo_id(1,100+d),doctor_names[d],
      'Шүдний ерөнхий эмчилгээ','Туршилтын эмчийн мэдээлэл',d);
    FOR i IN 0..6 LOOP
      INSERT INTO "Schedule" (id,"doctorId",weekday,"startTime","endTime")
      VALUES (pg_temp.demo_id(3,d*10+i),doctor_id,i,'09:00','18:00');
    END LOOP;
    INSERT INTO "Leave" (id,"doctorId",date,reason,kind,status,"reviewedById","reviewedAt")
    VALUES (pg_temp.demo_id(4,d),doctor_id,(base_date+9+d)::text,
      'Демо: сургалтад оролцох','DAY_OFF',CASE WHEN d=3 THEN 'PENDING' ELSE 'APPROVED' END,
      CASE WHEN d=3 THEN NULL ELSE admin_id END,CASE WHEN d=3 THEN NULL ELSE now() END);
  END LOOP;

  FOR i IN 1..8 LOOP
    INSERT INTO "Service" (id,name,category,description,price,duration,"doctorIds","sortOrder")
    VALUES (pg_temp.demo_id(5,i),services[i],CASE WHEN i>=7 THEN 'Хүүхдийн шүд' ELSE 'Ерөнхий эмчилгээ' END,
      'Демо үйлчилгээ',prices[i],CASE WHEN i IN (4,6) THEN 60 ELSE 30 END,
      ARRAY[pg_temp.demo_id(2,1),pg_temp.demo_id(2,2),pg_temp.demo_id(2,3)],i);
  END LOOP;

  FOR i IN 1..60 LOOP
    patient_id := pg_temp.demo_id(6,i);
    INSERT INTO "Patient" (id,name,phone,"birthDate",gender,"guardianName","guardianPhone",address,allergies,"medicalHistory","createdAt")
    VALUES (patient_id,surnames[1+(i-1)/10] || '. ' || names[1+(i-1)%10],(88000000+i)::text,
      to_char(base_date-make_interval(years => CASE WHEN i<=10 THEN 8+i%5 ELSE 20+i%40 END),'YYYY-MM-DD'),
      CASE WHEN i%2=0 THEN 'MALE' ELSE 'FEMALE' END,
      CASE WHEN i<=10 THEN 'Демо асран хамгаалагч ' || i ELSE '' END,
      CASE WHEN i<=10 THEN (89000000+i)::text ELSE '' END,
      'Улаанбаатар, демо хаяг ' || i,
      CASE WHEN i%13=0 THEN 'Пенициллин (демо)' ELSE '' END,'Демо түүх',
      ((base_date-60+i%20)::timestamp AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC');
    INSERT INTO "PatientNote" (id,"patientId","authorId",content)
    VALUES (pg_temp.demo_id(7,i),patient_id,pg_temp.demo_id(1,101),'Туршилтын тэмдэглэл: давтан үзлэгт хянана.');
  END LOOP;

  -- 36 days x 3 doctors x 4 non-overlapping slots = 432 appointments.
  FOR day_offset IN -28..7 LOOP
    appt_date := base_date+day_offset;
    FOR d IN 1..3 LOOP
      FOR slot IN 0..3 LOOP
        k := k+1;
        patient_no := 1+(k-1)%60;
        service_no := CASE WHEN patient_no<=10 THEN 7+k%2 ELSE 1+k%6 END;
        patient_id := pg_temp.demo_id(6,patient_no);
        doctor_id := pg_temp.demo_id(2,d);
        service_id := pg_temp.demo_id(5,service_no);
        appt_id := pg_temp.demo_id(8,k);
        start_time := lpad((9+slot*2)::text,2,'0') || ':00';
        event_at := ((appt_date+start_time::time) AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC';
        appt_status := CASE
          WHEN day_offset<0 AND k%11=0 THEN 'CANCELLED'
          WHEN day_offset<0 AND k%9=0 THEN 'NO_SHOW'
          WHEN day_offset<0 THEN 'COMPLETED'
          WHEN day_offset=0 AND slot=0 THEN 'COMPLETED'
          WHEN day_offset=0 AND slot=1 THEN 'ARRIVED'
          WHEN k%3=0 THEN 'PENDING' ELSE 'CONFIRMED' END;
        INSERT INTO "Appointment" (id,"patientId","doctorId","serviceId",date,"startTime","endTime",status,
          note,"contactName","birthDate",gender,"guardianName","guardianPhone","createdById","createdAt")
        SELECT appt_id,patient_id,doctor_id,service_id,appt_date::text,start_time,
          to_char(start_time::time+make_interval(mins => CASE WHEN service_no IN (4,6) THEN 60 ELSE 30 END),'HH24:MI'),
          appt_status,'Демо цаг захиалга',p.name,p."birthDate",p.gender,p."guardianName",p."guardianPhone",reception_id,event_at-interval '2 days'
        FROM "Patient" p WHERE p.id=patient_id;

        IF appt_status='COMPLETED' THEN
          treatment_id := pg_temp.demo_id(9,k);
          invoice_id := pg_temp.demo_id(10,k);
          amount_due := prices[service_no];
          INSERT INTO "Treatment" (id,"patientId","doctorId","serviceId","appointmentId",tooth,diagnosis,procedure,note,date,amount,"createdAt")
          VALUES (treatment_id,patient_id,doctor_id,service_id,appt_id,
            CASE WHEN patient_no<=10 THEN 55 ELSE 16 END,'Демо онош',services[service_no],'Туршилтын эмчилгээ',appt_date::text,amount_due,event_at);
          INSERT INTO "Invoice" (id,number,"patientId","appointmentId",status,total,"dueDate","createdById","createdAt","finalizedAt")
          VALUES (invoice_id,'DEMO-' || lpad(k::text,6,'0'),patient_id,appt_id,'FINALIZED',amount_due,appt_date::text,reception_id,event_at,event_at);
          INSERT INTO "InvoiceItem" (id,"invoiceId","treatmentId","serviceId",description,quantity,"unitPrice")
          VALUES (pg_temp.demo_id(11,k),invoice_id,treatment_id,service_id,services[service_no],1,amount_due);
          -- Full, partial and unpaid invoices for receivables/report screens.
          paid := CASE WHEN k%7=0 THEN 0 WHEN k%5=0 THEN amount_due/2 ELSE amount_due END;
          IF paid>0 THEN
            payment_method := (ARRAY['CASH','CARD','TRANSFER','QPAY']::"PaymentMethod"[])[1+k%4];
            INSERT INTO "Payment" (id,"patientId","appointmentId",amount,method,note,date,"createdById","invoiceId",reference,"idempotencyKey","createdAt")
            VALUES (pg_temp.demo_id(12,k),patient_id,appt_id,paid,payment_method,'Демо төлбөр',appt_date::text,
              reception_id,invoice_id,'DEMO-' || k,'demo-payment-' || k,event_at+interval '30 minutes');
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Queue numbering follows any existing queue entries for today.
  INSERT INTO "QueueEntry" (id,"appointmentId","patientId","doctorId",date,number,status,"arrivedAt","calledAt","startedAt","completedAt","createdById")
  SELECT pg_temp.demo_id(13,row_number() OVER (ORDER BY a.id)::integer),a.id,a."patientId",a."doctorId",a.date,
    COALESCE((SELECT max(q.number) FROM "QueueEntry" q WHERE q.date=base_date::text),0)+row_number() OVER (ORDER BY a.id)::integer,
    CASE WHEN a.status='COMPLETED' THEN 'COMPLETED' ELSE 'WAITING' END,
    ((a.date::date+a."startTime"::time) AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC',
    CASE WHEN a.status='COMPLETED' THEN ((a.date::date+a."startTime"::time) AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC' END,
    CASE WHEN a.status='COMPLETED' THEN ((a.date::date+a."startTime"::time) AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC' END,
    CASE WHEN a.status='COMPLETED' THEN ((a.date::date+a."endTime"::time) AT TIME ZONE 'Asia/Ulaanbaatar') AT TIME ZONE 'UTC' END,
    reception_id
  FROM "Appointment" a WHERE a.id LIKE 'bbde0000-0000-4000-8000-0008%' AND a.date=base_date::text AND a.status IN ('ARRIVED','COMPLETED');

  FOR i IN 1..10 LOOP
    INSERT INTO "InventoryItem" (id,name,sku,unit,quantity,minimum,supplier)
    VALUES (pg_temp.demo_id(14,i),
      (ARRAY['Бээлий','Маск','Хөвөн','Шүдний композит','Мэдээ алдуулагч','Ариутгалын уусмал','Шүдний сойз','Фтор гель','Суваг дүүргэгч','Нэг удаагийн аяга'])[i],
      'DEMO-SKU-' || i,'ш',CASE WHEN i%4=0 THEN 3 ELSE 100+i*5 END,10,'Демо нийлүүлэгч');
    INSERT INTO "StockMovement" (id,"itemId",quantity,reason,"createdById")
    SELECT pg_temp.demo_id(15,i),id,quantity,'Демо эхний үлдэгдэл',admin_id FROM "InventoryItem" WHERE id=pg_temp.demo_id(14,i);
    INSERT INTO "Expense" (id,title,category,amount,date,note,"createdById")
    VALUES (pg_temp.demo_id(16,i),'Демо зардал ' || i,'Материал',15000*i,(base_date-i*2)::text,'Туршилтын зардал',admin_id);
    INSERT INTO "NurseShift" (id,name,date,"startTime","endTime")
    VALUES (pg_temp.demo_id(17,i),'Демо сувилагч ' || (1+i%2),(base_date-3+i)::text,'09:00','18:00');
    INSERT INTO "Document" (id,"patientId",title,type,content,"createdById")
    VALUES (pg_temp.demo_id(18,i),pg_temp.demo_id(6,i),'Демо баримт','NOTE','Туршилтын баримтын агуулга.',admin_id);
  END LOOP;

  INSERT INTO "PatientTransfer" (id,"patientId","sourceDoctorId","targetDoctorId",reason,"createdById")
  VALUES (pg_temp.demo_id(19,1),pg_temp.demo_id(6,1),pg_temp.demo_id(2,1),pg_temp.demo_id(2,2),'Демо: давтан үзлэгт шилжүүлэх',pg_temp.demo_id(1,101));
  INSERT INTO "AuditLog" (id,"actorId",action,entity,"entityId")
  VALUES (pg_temp.demo_id(20,1),admin_id,'DEMO_SEED','demo','v1');
  INSERT INTO "Setting" (key,value) VALUES ('demoSeed.v1',base_date::text);
  RAISE NOTICE 'Demo seed complete: 5 users, 3 doctors, 8 services, 60 patients, 432 appointments.';
END;
$$;

COMMIT;
