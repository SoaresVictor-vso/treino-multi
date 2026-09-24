BEGIN;
DO $$
DECLARE ta uuid; tb uuid; pa uuid; padmina uuid; padminb uuid; ptrainer uuid;
  athlete uuid; admina uuid; adminb uuid; trainer uuid; trainer_association uuid;
  old_ep uuid; new_ep uuid; b_ep uuid; old_w uuid; new_w uuid; b_w uuid; self_w uuid;
BEGIN
  INSERT INTO tenants(name,trade_name,slug) VALUES ('A','A','test-a') RETURNING id INTO ta;
  INSERT INTO tenants(name,trade_name,slug) VALUES ('B','B','test-b') RETURNING id INTO tb;
  INSERT INTO persons(name,email) VALUES ('Atleta','atleta@test.local') RETURNING id INTO pa;
  INSERT INTO persons(name,email) VALUES ('Admin A','admina@test.local') RETURNING id INTO padmina;
  INSERT INTO persons(name,email) VALUES ('Admin B','adminb@test.local') RETURNING id INTO padminb;
  INSERT INTO persons(name,email) VALUES ('Trainer A','trainer@test.local') RETURNING id INTO ptrainer;
  INSERT INTO users(person_id,tenant_id,context,password_hash) VALUES (pa,NULL,'standalone','hash') RETURNING id INTO athlete;
  INSERT INTO users(person_id,tenant_id,context,password_hash) VALUES (padmina,ta,'tenant','hash') RETURNING id INTO admina;
  INSERT INTO users(person_id,tenant_id,context,password_hash) VALUES (padminb,tb,'tenant','hash') RETURNING id INTO adminb;
  INSERT INTO users(person_id,tenant_id,context,password_hash) VALUES (ptrainer,ta,'tenant','hash') RETURNING id INTO trainer;
  INSERT INTO user_roles(user_id,role) VALUES (athlete,'tenant:client'),(admina,'tenant:admin'),(adminb,'tenant:admin'),(trainer,'tenant:trainer');
  INSERT INTO athlete_tenant_associations(athlete_id,tenant_id,status,invited_at,expires_at,started_at,ended_at)
    VALUES (athlete,ta,'cancelled',now()-interval '30 days',now()-interval '23 days',now()-interval '29 days',now()-interval '15 days') RETURNING id INTO old_ep;
  INSERT INTO athlete_tenant_associations(athlete_id,tenant_id,status,invited_at,expires_at,started_at)
    VALUES (athlete,ta,'active',now()-interval '2 days',now()+interval '5 days',now()-interval '1 day') RETURNING id INTO new_ep;
  INSERT INTO athlete_tenant_associations(athlete_id,tenant_id,status,invited_at,expires_at,started_at)
    VALUES (athlete,tb,'active',now()-interval '2 days',now()+interval '5 days',now()-interval '1 day') RETURNING id INTO b_ep;
  INSERT INTO workouts(tenant_id,athlete_id,origin,athlete_tenant_association_id,template_name,created_by,updated_by)
    VALUES (ta,athlete,'tenant',old_ep,'Old',admina,admina) RETURNING id INTO old_w;
  INSERT INTO workouts(tenant_id,athlete_id,origin,athlete_tenant_association_id,template_name,created_by,updated_by)
    VALUES (ta,athlete,'tenant',new_ep,'New',admina,admina) RETURNING id INTO new_w;
  INSERT INTO workouts(tenant_id,athlete_id,origin,athlete_tenant_association_id,template_name,created_by,updated_by)
    VALUES (tb,athlete,'tenant',b_ep,'B',adminb,adminb) RETURNING id INTO b_w;
  INSERT INTO workouts(tenant_id,athlete_id,origin,template_name,created_by,updated_by)
    VALUES (NULL,athlete,'athlete','Self',athlete,athlete) RETURNING id INTO self_w;
  UPDATE athlete_tenant_associations SET status='pending',started_at=NULL WHERE id=new_ep;
  IF can_read_athlete_workout(new_w,admina) OR can_read_athlete_profile(athlete,admina)
    OR can_prescribe_athlete(athlete,admina) THEN RAISE EXCEPTION 'pending grants access'; END IF;
  UPDATE athlete_tenant_associations SET status='active',started_at=now() WHERE id=new_ep;
  IF can_read_athlete_workout(new_w,trainer) OR can_prescribe_athlete(athlete,trainer)
    THEN RAISE EXCEPTION 'unassociated trainer grants access'; END IF;
  INSERT INTO athlete_trainer_associations(athlete_id,treinador_id,athlete_tenant_association_id,data_inicio,usuario_inicio_id)
    VALUES (athlete,trainer,new_ep,current_date,admina) RETURNING id INTO trainer_association;
  IF NOT can_read_athlete_workout(new_w,trainer) OR NOT can_prescribe_athlete(athlete,trainer)
    THEN RAISE EXCEPTION 'associated trainer denied'; END IF;
  IF NOT can_read_athlete_workout(new_w,admina) OR can_read_athlete_workout(old_w,admina)
    OR can_read_athlete_workout(b_w,admina) OR can_read_athlete_workout(self_w,admina) THEN RAISE EXCEPTION 'default scope'; END IF;
  UPDATE athlete_tenant_associations SET scope='PRESCRIBED_BY_TENANT_LIFETIME' WHERE id=new_ep;
  IF NOT can_read_athlete_workout(old_w,admina) OR can_read_athlete_workout(b_w,admina) THEN RAISE EXCEPTION 'lifetime scope'; END IF;
  UPDATE athlete_tenant_associations SET scope='TENANT_AND_ATHLETE' WHERE id=new_ep;
  IF NOT can_read_athlete_workout(self_w,admina) OR can_read_athlete_workout(old_w,admina) THEN RAISE EXCEPTION 'tenant athlete scope'; END IF;
  UPDATE athlete_tenant_associations SET scope='ALL_WORKOUTS' WHERE id=new_ep;
  IF NOT can_read_athlete_workout(old_w,admina) OR NOT can_read_athlete_workout(b_w,admina) THEN RAISE EXCEPTION 'all scope'; END IF;
  IF NOT can_read_athlete_workout(b_w,adminb) OR can_read_athlete_workout(new_w,adminb) THEN RAISE EXCEPTION 'other tenant'; END IF;
  UPDATE athlete_tenant_associations SET status='cancelled',ended_at=now() WHERE id=new_ep;
  IF can_read_athlete_workout(new_w,admina) OR can_read_athlete_profile(athlete,admina)
    OR can_read_athlete_workout(new_w,trainer) THEN RAISE EXCEPTION 'cancelled scope'; END IF;
  IF NOT can_read_athlete_workout(old_w,athlete) OR NOT can_read_athlete_workout(new_w,athlete)
    OR NOT can_read_athlete_workout(b_w,athlete) OR NOT can_read_athlete_workout(self_w,athlete) THEN RAISE EXCEPTION 'athlete retains data'; END IF;
END $$;
ROLLBACK;
