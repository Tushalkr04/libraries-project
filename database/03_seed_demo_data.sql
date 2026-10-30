WHENEVER SQLERROR EXIT SQL.SQLCODE

MERGE INTO books target
USING (
  SELECT 'Pride and Prejudice' title, 'Jane Austen' author, 5 copies FROM dual
  UNION ALL SELECT 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 4 FROM dual
  UNION ALL SELECT 'Frankenstein', 'Mary Shelley', 4 FROM dual
  UNION ALL SELECT 'Alice''s Adventures in Wonderland', 'Lewis Carroll', 5 FROM dual
  UNION ALL SELECT 'Little Women', 'Louisa May Alcott', 4 FROM dual
  UNION ALL SELECT 'Moby-Dick', 'Herman Melville', 3 FROM dual
  UNION ALL SELECT 'Great Expectations', 'Charles Dickens', 4 FROM dual
  UNION ALL SELECT 'Dracula', 'Bram Stoker', 4 FROM dual
  UNION ALL SELECT 'The Time Machine', 'H. G. Wells', 4 FROM dual
  UNION ALL SELECT 'A Tale of Two Cities', 'Charles Dickens', 3 FROM dual
  UNION ALL SELECT 'The Secret Garden', 'Frances Hodgson Burnett', 4 FROM dual
  UNION ALL SELECT 'The Wonderful Wizard of Oz', 'L. Frank Baum', 4 FROM dual
  UNION ALL SELECT 'The Call of the Wild', 'Jack London', 4 FROM dual
  UNION ALL SELECT 'The War of the Worlds', 'H. G. Wells', 3 FROM dual
  UNION ALL SELECT 'The Picture of Dorian Gray', 'Oscar Wilde', 3 FROM dual
) source
ON (target.title = source.title AND target.author = source.author)
WHEN NOT MATCHED THEN
  INSERT (title, author, total_copies, available_copies)
  VALUES (source.title, source.author, source.copies, source.copies);

MERGE INTO members target
USING (
  SELECT 'Alex Morgan' name, 'alex.morgan@libraries.demo' email FROM dual
  UNION ALL SELECT 'Jamie Rivera', 'jamie.rivera@libraries.demo' FROM dual
  UNION ALL SELECT 'Taylor Chen', 'taylor.chen@libraries.demo' FROM dual
  UNION ALL SELECT 'Jordan Patel', 'jordan.patel@libraries.demo' FROM dual
  UNION ALL SELECT 'Casey Brooks', 'casey.brooks@libraries.demo' FROM dual
  UNION ALL SELECT 'Riley Kim', 'riley.kim@libraries.demo' FROM dual
) source
ON (target.email = source.email)
WHEN NOT MATCHED THEN
  INSERT (name, email)
  VALUES (source.name, source.email);

DECLARE
  v_existing NUMBER;
  v_available books.available_copies%TYPE;
BEGIN
  FOR seed_loan IN (
    SELECT b.book_id, m.member_id
      FROM (
        SELECT 'Pride and Prejudice' title, 'alex.morgan@libraries.demo' email FROM dual
        UNION ALL SELECT 'Frankenstein', 'jamie.rivera@libraries.demo' FROM dual
        UNION ALL SELECT 'The Adventures of Sherlock Holmes', 'taylor.chen@libraries.demo' FROM dual
        UNION ALL SELECT 'The Time Machine', 'jordan.patel@libraries.demo' FROM dual
      ) sample
      JOIN books b ON b.title = sample.title
      JOIN members m ON m.email = sample.email
  ) LOOP
    SELECT COUNT(*)
      INTO v_existing
      FROM loans
     WHERE book_id = seed_loan.book_id
       AND member_id = seed_loan.member_id
       AND returned_on IS NULL;

    IF v_existing = 0 THEN
      SELECT available_copies
        INTO v_available
        FROM books
       WHERE book_id = seed_loan.book_id
         FOR UPDATE;

      IF v_available = 0 THEN
        RAISE_APPLICATION_ERROR(-20011, 'Not enough available copies to create the demo checkouts.');
      END IF;

      libraries_api.issue_book(seed_loan.book_id, seed_loan.member_id);
    END IF;
  END LOOP;

  COMMIT;
END;
/

SELECT 'Demo books: ' || COUNT(*) FROM books;
SELECT 'Demo members: ' || COUNT(*) FROM members;
SELECT 'Active checkouts: ' || COUNT(*) FROM loans WHERE returned_on IS NULL;
