Prompt: Xây dựng mô hình 3D Cầu Rồng (Đà Nẵng) bằng Three.js

Bạn là một kỹ sư đồ họa 3D và lập trình WebGL giàu kinh nghiệm. Hãy dùng Three.js (phiên bản mới, import qua ES module hoặc import map từ CDN) để xây dựng một cảnh 3D trong một file HTML duy nhất mô phỏng Cầu Rồng (Dragon Bridge / Cầu Rồng Đà Nẵng) bắc qua sông Hàn, thành phố Đà Nẵng, Việt Nam. Mục tiêu là mô hình càng giống công trình thật càng tốt về hình dáng, kết cấu, tỷ lệ, màu sắc và bối cảnh.

1. Thông số cơ bản (dùng làm chuẩn)

Quy ước: 1 đơn vị Three.js = 1 mét. Mọi kích thước phải theo thang này.

Tổng chiều dài: khoảng 666 m.
Nhịp chính: 5 nhịp chính (main spans), nhịp vòm trung tâm dài khoảng 200 m. Cộng thêm 3 nhịp dẫn (approach spans) ở hai đầu.
Bề rộng mặt cắt ngang: khoảng 37,5 m (tổng thể, gồm dải phân cách và lề đi bộ).
Làn xe: 6 làn ô tô, chia 3 làn mỗi chiều, mỗi làn khoảng 3,5–3,75 m. Dải phân cách giữa khoảng 6 m.
Lối đi bộ: 2 bên, mỗi bên khoảng 2,5 m.
Kết cấu: vòm thép kết hợp dầm hộp thép và bê tông (hybrid), có dây cáp treo (hanger) nối vòm với mặt cầu. Phần thân rồng là các dải vòm thép lượn sóng.
Đầu rồng: nằm ở một đầu cầu, cao khoảng 18 m và được trang trí vảy kim loại. Phần đuôi nằm ở đầu còn lại.
Vị trí: bắc qua sông Hàn tại vòng xoay Lê Đình Dương / Bạch Đằng, nối sân bay quốc tế Đà Nẵng với trung tâm và bờ biển Mỹ Khê, Non Nước.
Tọa độ tham khảo: khoảng 16,061°N, 108,227°E (cần đối chiếu lại bằng bản đồ trước khi dùng).

Lưu ý về độ chắc chắn: các nguồn về trọng lượng và chiều cao đầu rồng không thống nhất (có nguồn ghi 900 tấn, có nguồn ghi gần 9.000 tấn; chiều cao đầu rồng và độ rộng mặt cầu cũng khác nhau giữa các nguồn). Khi có mâu thuẫn, ưu tiên thông số về chiều dài 666 m, nhịp 200 m, rộng 37,5 m, 6 làn xe. Các chi tiết khác nên ghi chú là “ước lượng” trong code.

2. Hình dáng và kiến trúc

Thân rồng (linh hồn của cây cầu):

Thân không thẳng mà uốn lượn nhịp nhàng theo hình sóng, như một con rồng đang bay trên sông.
Dùng một đường cong 3D (ví dụ THREE.CatmullRomCurve3) làm “xương sống” cho thân rồng. Đường cong có độ cao thay đổi: nhô lên ở giữa nhịp vòm và hạ thấp dần ở hai đầu tiếp đất.
Vòm chính là một cung thép dạng nửa-vòm (half-through arch), với các sườn thép (ribs) nhô ra khỏi mặt phẳng cầu.
Vảy rồng: dùng InstancedMesh để tạo hàng trăm đến hàng nghìn vảy nhỏ phủ dọc thân, xếp chồng lên nhau theo kiểu vảy cá. Vảy có thể là các tấm hình thoi hoặc giọt nước, cong nhẹ, màu vàng kim.
Các dây cáp (hanger) nối từ vòm xuống mặt cầu: dùng CylinderGeometry mảnh, phân bố đều theo chiều dài nhịp.

Mặt cầu (deck):

Mặt phẳng hơi uốn theo đường cong của thân rồng, với độ dốc nhẹ.
Bề mặt là bê tông xám nhạt, có vạch kẻ làn đường màu trắng và vạch dải phân cách.
Dầm hộp thép ẩn dưới mặt cầu. Có thể thể hiện bằng một khối hộp phía dưới để tạo độ dày thực.
Lan can hai bên: thanh thép thấp, đều, có thể dùng InstancedMesh để tiết kiệm hiệu năng.

Đầu rồng:

Mô hình đầu với hàm, răng, mắt, sừng, mào và râu, dựng bằng các khối BufferGeometry có chỉnh sửa đỉnh hoặc ghép từ các SphereGeometry, ConeGeometry, TorusGeometry.
Đầu hướng về một phía, miệng mở, là nơi có hiệu ứng phun lửa và nước.
Thân rồng nối với đầu bằng một đoạn cổ cong mượt.

Màu sắc và vật liệu:

Thân rồng và vảy: vàng kim, dùng MeshStandardMaterial với metalness khoảng 0,8–1,0 và roughness khoảng 0,3–0,4. Kết hợp envMap từ một CubeTexture hoặc RoomEnvironment để có phản xạ.
Mặt cầu: xám bê tông, roughness cao.
Dây cáp: xám bạc, metalness cao.
3. Hệ thống ánh sáng và thời gian trong ngày

Tạo hai chế độ, có thể chuyển bằng giao diện đơn giản (nút hoặc slider):

Ban ngày:

DirectionalLight làm ánh sáng mặt trời, bật shadow map (độ phân giải 2048 hoặc 4096), căn chỉnh vùng shadow đủ rộng để bao trùm cầu.
HemisphereLight để ánh sáng môi trường.
Bầu trời: dùng Sky từ three/addons/objects/Sky.js với màu xanh nhạt và mây nhẹ.

Ban đêm:

Giảm cường độ ánh sáng môi trường, nền trời tối xanh đen.
Đèn LED viền thân rồng và đèn chiếu sáng trên mặt cầu, dùng PointLight hoặc SpotLight đặt dọc cầu, màu vàng ấm và xanh lam.
Hiệu ứng nhấp nháy nhẹ và đổi màu theo thời gian (dùng sin(time)).
Đèn trên thân rồng có thể nhấp nháy theo nhịp sóng, tạo cảm giác rồng “sống động”.
4. Hiệu ứng phun lửa và phun nước

Đây là điểm nhấn đặc trưng của cầu. Trong thực tế, rồng phun lửa và nước vào tối thứ Bảy và Chủ Nhật lúc 21:00. Mô hình nên có:

Chế độ trình diễn bật/tắt bằng nút. Khi bật, đầu rồng phun một cột lửa ngắn và một cột nước.
Lửa: hệ thống hạt (Points hoặc InstancedMesh) với sprite lửa có màu cam, vàng và đỏ. Hạt có vòng đời ngắn, bay lên và mờ dần. Thêm AdditiveBlending để có cảm giác sáng.
Nước: hạt xanh trong suốt, rơi theo trọng lực đơn giản, có thể thêm chút hiệu ứng sương.
Lửa phát sáng nên tác động lên ánh sáng gần đó bằng một PointLight cam nhấp nháy.
Lặp lại chu kỳ trình diễn khoảng 30–60 giây.
5. Sông Hàn và mặt nước
Mặt nước: PlaneGeometry lớn, dùng shader hoặc Water từ three/addons/objects/Water.js để có sóng và phản chiếu. Màu nước sông Hàn hơi xanh đục, không quá trong.
Bờ sông hai bên: dải đất thấp với cây xanh và kè đá.
Có thể thêm vài chiếc thuyền nhỏ hoặc thuyền du lịch trôi chậm dọc sông, đơn giản hóa bằng hình khối.
6. Bối cảnh xung quanh

Dựng một khu vực đô thị đơn giản nhưng nhận diện được, phù hợp với trung tâm Đà Nẵng:

Tòa nhà cao tầng: các khối hộp có độ cao khác nhau, dọc bờ đông và bờ tây sông Hàn. Dùng màu trắng, kem, xám nhạt và xanh nhạt, có cửa sổ lưới đơn giản (có thể dùng texture procedural hoặc CanvasTexture).
Cầu Trần Thị Lý: cầu dây văng (cable-stayed) gần đó, có một tháp nghiêng đặc trưng với dây cáp đỏ. Tham khảo thông tin: cầu có chiều dài khoảng 731 m, tháp cao khoảng 145 m, dây cáp màu đỏ nổi bật. Đây là cầu dễ nhận diện nhất bên cạnh Cầu Rồng.
Đường phố: đường Bạch Đằng và Lê Đình Dương ven bờ, dải đường nhựa xám có vạch trắng, dải phân cách cây xanh.
Cây xanh: cây tròn đơn giản (SphereGeometry xanh lá) và cây thân cao (CylinderGeometry + khối tán). Dùng InstancedMesh để tối ưu.
Đèn đường: cột đèn thấp dọc vỉa hè, phát sáng ban đêm.
Xe cộ: các khối hộp nhỏ di chuyển dọc làn đường bằng vòng lặp đơn giản, có thể dùng đường cong TubeGeometry làm quỹ đạo. Đây là chi tiết giúp cảnh sống động.
Xa xa: ngọn núi Sơn Trà ở phía đông bắc (làm nền đường chân trời), bằng vài khối đất cao màu xanh đậm.
Biển: nếu cảnh đủ rộng, có thể thêm một mảng biển xanh ở xa phía đông.
7. Điều khiển và trải nghiệm người dùng
OrbitControls cho phép xoay, zoom và di chuyển quanh cầu.
Các góc nhìn có sẵn (nút bấm): toàn cảnh từ trên cao, nhìn từ đầu rồng, nhìn từ đuôi rồng, nhìn dọc mặt cầu như đang lái xe, góc nhìn chim bay ven sông.
Chế độ đi bộ (tùy chọn): camera đi dọc lề đi bộ với phím mũi tên hoặc WASD.
Giao diện tối giản: tiêu đề “Cầu Rồng – Đà Nẵng”, nút chuyển ngày/đêm, nút bật trình diễn lửa, nút đổi góc nhìn, và một bảng nhỏ hiển thị thông số (dài 666 m, rộng 37,5 m, 6 làn xe).
Có thể bật/tắt bóng đổ và đo FPS để người dùng thấy hiệu năng.
8. Hiệu năng
Dùng InstancedMesh cho vảy rồng, cây, dây cáp, cột đèn và xe cộ.
Giới hạn số hạt lửa và nước ở mức vài trăm.
Dùng LOD cho các tòa nhà xa.
Tổng số draw call nên dưới khoảng 200.
Đặt renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).
Xử lý thay đổi kích thước cửa sổ (resize).
Có vòng lặp requestAnimationFrame dùng THREE.Clock để các hiệu ứng chạy theo thời gian thực, không phụ thuộc tốc độ máy.
9. Cấu trúc code đề xuất
Khai báo: import Three.js và các addon (OrbitControls, Sky, Water, RoomEnvironment) qua import map.
Hằng số: toàn bộ thông số kích thước đặt trong một object CONFIG để dễ chỉnh sửa.
Hàm dựng cầu: buildBridgeDeck(), buildDragonBody(), buildDragonHead(), buildScales(), buildHangers(), buildLights().
Hàm dựng bối cảnh: buildRiver(), buildCity(), buildTrees(), buildTraffic(), buildCableStayBridge().
Hiệu ứng: createFire(), createWaterJet(), updateEffects(dt).
Điều khiển: setupUI() gắn các nút và slider vào hàm tương ứng.
Vòng lặp: animate() cập nhật hiệu ứng, lưu lượng xe, ánh sáng nhấp nháy.

Viết code rõ ràng, có chú thích tiếng Việt ở các phần quan trọng, và mỗi hàm dựng chỉ làm một nhiệm vụ.

10. Tiêu chí hoàn thành

Sản phẩm được coi là đạt yêu cầu khi:

Hình dáng thân rồng uốn lượn nhận ra được, với đầu và đuôi rõ ràng.
Cầu có 5 nhịp chính với vòm trung tâm lớn, mặt cầu có 6 làn xe và lề đi bộ hai bên.
Vảy rồng, dây cáp và lan can đều có mặt.
Có bối cảnh sông Hàn, các tòa nhà, Cầu Trần Thị Lý và cây xanh.
Chuyển được giữa ban ngày và ban đêm.
Trình diễn lửa và nước hoạt động.
Các góc nhìn và điều khiển hoạt động mượt trên máy tính thông thường.
Không có lỗi trong console khi chạy.
11. Cần thêm thông tin gì để làm tốt hơn?

Để mô hình chính xác hơn, bạn có thể cung cấp thêm:

Ảnh tham khảo chụp đầu rồng, thân rồng và mặt cầu từ nhiều góc. Đây là nguồn quan trọng nhất để chỉnh hình dáng vảy và đầu.
Màu sơn chính xác của cầu (nếu bạn có ảnh gần).
Bản vẽ hoặc dữ liệu GIS của cầu và khu vực xung quanh, nếu có.
Mức chi tiết mong muốn: mô hình minh họa đơn giản để chạy nhẹ, hay mô hình chi tiết để trình bày.
Có cần chạy trên điện thoại không, vì điều này ảnh hưởng đến số lượng vảy, hạt và bóng đổ.