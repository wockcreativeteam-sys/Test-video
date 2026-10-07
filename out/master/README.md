# Full-quality master, in 6 parts

`wockhardt_reengineered_1080p_master.mp4` — 1920×1080, 30 fps, H.264 CRF 17 + AAC 256k, 106 s, 500 MB.
GitHub rejects single files over 100 MB, so the master is stored here in 6 pieces.
Download all 6 `.part` files into one folder, then join them:

**Mac** (Terminal, in that folder):

    cat wockhardt_reengineered_1080p_master.mp4.part* > wockhardt_reengineered_1080p_master.mp4

**Windows** (Command Prompt, in that folder):

    copy /b wockhardt_reengineered_1080p_master.mp4.part1of6 + wockhardt_reengineered_1080p_master.mp4.part2of6 + wockhardt_reengineered_1080p_master.mp4.part3of6 + wockhardt_reengineered_1080p_master.mp4.part4of6 + wockhardt_reengineered_1080p_master.mp4.part5of6 + wockhardt_reengineered_1080p_master.mp4.part6of6 wockhardt_reengineered_1080p_master.mp4

SHA-256 of the joined file: `6633be4f0470ad95f75eaf06d99a42205835b81081fbe29b7cb17545cbedf5eb`
(check with `shasum -a 256 wockhardt_reengineered_1080p_master.mp4` on Mac, `certutil -hashfile wockhardt_reengineered_1080p_master.mp4 SHA256` on Windows).

For web, social and email, `out/wockhardt_reengineered_1080p_web.mp4` (84 MB, single file) is
the same cut at a streaming bitrate.
