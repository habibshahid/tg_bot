<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
    <div id="page-content-wrapper">

      <?php $this->load->view('templates/top_nav'); ?>

      <div class="container-fluid">
        <h1 class="mt-4">Dashboard</h1>
        <table id="cdrs_table" class="table table-striped table-bordered" style="width:100%">
			<thead>
				<th>Call Date</th>
				<th>DID / Caller Id</th>
				<th>Customer</th>
				<th>Branch</th>
				<th>Admin</th>
				<th>DTMF</th>
				<th>Hold</th>
				<th>Mute Admin</th>
				<th>Hang up</th>
			</thead>
			<tbody>
				
			</tbody>
		</table>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->
  <?php $this->load->view('templates/footer'); ?>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.3.0/socket.io.js" integrity="sha512-v8ng/uGxkge3d1IJuEo6dJP8JViyvms0cly9pnbfRxT6/31c3dRWxIiwGnMSWwZjHKOuY3EVmijs7k1jz/9bLA==" crossorigin="anonymous"></script>

  <script>
		let socket;
		
		$(document).ready(function(){
			$('#cdrs_table').DataTable();
		});
	  
		socket = io('<?php echo $socket_io_url; ?>', {
			query:`partyId=asui3ndyaslkdjasi&service=realtime`,
		});
		
		socket.on('connect', function () {
            console.log("connected!");
        });

        socket.on('error', function (err) {
            console.log('error',err);
        });
		
		socket.on('message', function (data) {
            console.log('message',data);
        });

        socket.on('callData', function(data) {
            console.log('callData', data);
			setTable(data)
        });

        socket.on('disconnect', function () {
            console.log('Got disconnect!');
		});
		
		function holdcall(channel, moh, uid, callHold, adminChannel){
			try {
				let url = '<?php echo base_url();?>home/holdCall';
				if(callHold == 1){
					url = '<?php echo base_url();?>home/unholdCall';
				}
				$.ajax({
					type: 'post',
					url: url,
					data: {
						'channel': channel,
						'moh': moh,
						'uid': uid,
						'<?php echo $this->security->get_csrf_token_name(); ?>':'<?php echo $this->security->get_csrf_hash(); ?>'
					},
					dataType: "json",
					success: function(res){
						console.log(res)
					},
					error: function(err){
						notify('error','error holding call', err);
					}
				});
				/*if(adminChannel && adminChannel != ''){
					$.ajax({
						type: 'post',
						url: url,
						data: {
							'channel': adminChannel,
							'moh': moh,
							'uid': uid,
							'<?php echo $this->security->get_csrf_token_name(); ?>':'<?php echo $this->security->get_csrf_hash(); ?>'
						},
						dataType: "json",
						success: function(res){
							console.log(res)
						},
						error: function(err){
							notify('error','error holding call', err);
						}
					});
				}*/
			}
			catch(err) {
				console.log(err);
			}
		}
		
		function muteAdmin(channel, uid, adminMute){
			try {
				let url = '<?php echo base_url();?>home/muteAdmin';
				if(adminMute == 1){
					url = '<?php echo base_url();?>home/unmuteAdmin';
				}
				$.ajax({
					type: 'post',
					url: url,
					data: {
						'channel': channel,
						'uid': uid,
						'<?php echo $this->security->get_csrf_token_name(); ?>':'<?php echo $this->security->get_csrf_hash(); ?>'
					},
					dataType: "json",
					success: function(res){
						console.log(res)
					},
					error: function(err){
						notify('error','error holding call', err);
					}
				});
			}
			catch(err) {
				console.log(err);
			}
		}
		
		function hangupcall(channel, id, uid){
			try {
				$.ajax({
					type: 'post',
					url: '<?php echo base_url();?>home/hangupCall',
					data: {
					'channel': channel,
						'id': id,
						'<?php echo $this->security->get_csrf_token_name(); ?>':'<?php echo $this->security->get_csrf_hash(); ?>'
					},
					dataType: "json",
					success: function(res){
						console.log(res)
						const t = $('#cdrs_table').DataTable();
						t.row(`[id="ivc_${uid}"]`).remove().draw();
					},
					error: function(err){
						notify('error','error hangup call', err);
					}
				});
			}
			catch(err) {
				console.log(err);
			}
		}
		
		let callHold = 0;
		
		function setTable(d){
			try {
				const uid = d.uniqueId.split('.').join('_');
				const t = $('#cdrs_table').DataTable();
				let holdAction, adminMute;
				const hangUpAction = `<a onclick="hangupcall('${d.channel}','${d.id}','${uid}')" class="btn btn-xs btn-danger">Hang Up <i class="fa fa-refresh"></i></a>`;
				
				if(d.hold == 0){
					holdAction = `<a id="holdCall_${uid}" onclick="holdcall('${d.channel}','${d.moh}','${d.uniqueId}','${d.hold}', '${d.adminChannel}')" class="btn btn-xs btn-warning">Hold Call <i class="fa fa-refresh"></i></a>`;
				}
				else{
					holdAction = `<a id="holdCall_${uid}" onclick="holdcall('${d.channel}','${d.moh}','${d.uniqueId}','${d.hold}', '${d.adminChannel}')" class="btn btn-xs btn-warning">Resume Call <i class="fa fa-refresh"></i></a>`;
				}
				if(d.adminMute == 0){
					adminMute = `<a id="adminMute_${uid}" onclick="muteAdmin('${d.adminChannel}','${d.uniqueId}','${d.adminMute}')" class="btn btn-xs btn-warning">Mute Admin <i class="fa fa-refresh"></i></a>`;
				}
				else{
					adminMute = `<a id="adminMute_${uid}" onclick="muteAdmin('${d.adminChannel}','${d.uniqueId}','${d.adminMute}')" class="btn btn-xs btn-warning">Un-Mute Admin <i class="fa fa-refresh"></i></a>`;
				}
				
				if (t.rows(`[id="ivc_${uid}"]`).any()) {
					t.row(`[id="ivc_${uid}"]`).data([
						d.createdAt,
						d.callerId,
						(d.destination == '') ? d.did : d.destination,
						d.branchNumber,
						d.adminNumber,
						d.dtmf,
						holdAction,
						adminMute,
						hangUpAction,
					]).draw();
				} else {
					t.row.add([
						d.createdAt,
						d.callerId,
						(d.destination == '') ? d.did : d.destination,
						d.branchNumber,
						d.adminNumber,
						d.dtmf,
						holdAction,
						adminMute,
						hangUpAction,
					]).node().id = `ivc_${uid}`;
					t.draw(false);
				}
				
				if(d.callEnd != '0000-00-00 00:00:00'){
					t.row(`[id="ivc_${uid}"]`).remove().draw();
				}
			}
			catch(err) {
				console.log(err)
			}
		}
		
  </script>
  
</body>

</html>
