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
        <h3 class="mt-4">Add User</h3>
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("clients/add",$attributes);?>
			<div class="card mb-4">
				<div class="card-header">
					<h5>Basic Information</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Username <span class="text-danger">*</span></label>
							<input class="form-control" id="username" name="username" placeholder="Enter Username" value="<?php echo set_value('username'); ?>" required />
						</div>
						<div class="form-group col-md-6">
							<label>Email </span></label>
							<input class="form-control" id="email" name="email" type="email" placeholder="Enter Email" value="<?php echo set_value('email'); ?>" />
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>First Name <span class="text-danger">*</span></label>
							<input class="form-control" id="first_name" name="first_name" placeholder="Enter First Name" value="<?php echo set_value('first_name'); ?>" required />
						</div>
						<div class="form-group col-md-6">
							<label>Last Name <span class="text-danger">*</span></label>
							<input class="form-control" id="last_name" name="last_name" placeholder="Enter Last Name" value="<?php echo set_value('last_name'); ?>" required />
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Password <span class="text-danger">*</span></label>
							<input class="form-control" id="password" name="password" type="password" placeholder="Enter Password" required />
							<small class="form-text text-muted">Minimum 6 characters</small>
						</div>
						<div class="form-group col-md-6">
							<label>Telegram ID</label>
							<input class="form-control" id="telegram_id" name="telegram_id" placeholder="Enter Telegram ID" value="<?php echo set_value('telegram_id'); ?>" />
						</div>
					</div>
				</div>
			</div>
			
			<div class="card mb-4">
				<div class="card-header">
					<h5>Destination Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Destination Type <span class="text-danger">*</span></label>
							<select class="form-control" id="destination_type" name="destination_type" required>
								<option value="">Select Destination Type</option>
								<option value="trunk" <?php echo set_select('destination_type', 'trunk'); ?>>SIP Trunk</option>
								<option value="agent" <?php echo set_select('destination_type', 'agent'); ?>>Agent/Extension</option>
							</select>
							<small class="form-text text-muted">Choose whether calls route through SIP trunk or dedicated agent</small>
						</div>
					</div>
					
					<!-- Trunk Selection (hidden by default) -->
					<div id="trunk_selection" style="display: none;">
						<div class="row">
							<div class="form-group col-md-6">
								<label>Select SIP Trunk</label>
								<select class="form-control" id="destination_trunk" name="destination_trunk">
									<option value="">Select SIP Trunk</option>
									<?php foreach($sip_trunks as $sip_trunk): ?>
									<option value="<?php echo $sip_trunk->name; ?>" <?php echo set_select('destination_trunk', $sip_trunk->name); ?>>
										<?php echo $sip_trunk->name . ' (' . $sip_trunk->host . ')'; ?>
									</option>
									<?php endforeach; ?>
								</select>
							</div>
						</div>
					</div>
					
					<!-- Agent Selection (hidden by default) -->
					<div id="agent_selection" style="display: none;">
						<div class="row">
							<div class="form-group col-md-6">
								<label>Select Agent/Extension</label>
								<select class="form-control" id="destination_agent" name="destination_agent">
									<option value="">Loading agents...</option>
								</select>
								<small class="form-text text-muted">Each agent can only be assigned to one client</small>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div class="card mb-4">
				<div class="card-header">
					<h5>Account Settings</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>User Type</label>
							<select class="form-control" id="user_type" name="user_type" required>
								<option value="user" <?php echo set_select('user_type', 'user', TRUE); ?>>User</option>
								<option value="admin" <?php echo set_select('user_type', 'admin'); ?>>Admin</option>
							</select>
						</div>
						<div class="form-group col-md-6">
							<label>Status</label>
							<select class="form-control" id="status" name="status" required>
								<option value="active" <?php echo set_select('status', 'active', TRUE); ?>>Active</option>
								<option value="suspended" <?php echo set_select('status', 'suspended'); ?>>Suspended</option>
								<option value="inactive" <?php echo set_select('status', 'inactive'); ?>>Inactive</option>
							</select>
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Initial Balance</label>
							<input class="form-control" id="balance" name="balance" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('balance', '0.0000'); ?>" />
						</div>
						<div class="form-group col-md-6">
							<label>Credit Limit</label>
							<input class="form-control" id="credit_limit" name="credit_limit" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('credit_limit', '0.0000'); ?>" />
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Rate Card</label>
							<select class="form-control" id="rate_card_id" name="rate_card_id">
								<option value="">Select Rate Card</option>
								<?php foreach($rate_cards as $rate_card): ?>
								<option value="<?php echo $rate_card->id; ?>" <?php echo set_select('rate_card_id', $rate_card->id); ?>>
									<?php echo $rate_card->name . ' (' . $rate_card->currency . ')'; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
				</div>
			</div>
			<div class="card mb-4">
				<div class="card-header">
					<h5>Preferences</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Timezone</label>
							<select class="form-control" id="timezone" name="timezone">
								<option value="UTC" <?php echo set_select('timezone', 'UTC', TRUE); ?>>UTC</option>
								<option value="America/New_York" <?php echo set_select('timezone', 'America/New_York'); ?>>Eastern Time</option>
								<option value="America/Chicago" <?php echo set_select('timezone', 'America/Chicago'); ?>>Central Time</option>
								<option value="America/Denver" <?php echo set_select('timezone', 'America/Denver'); ?>>Mountain Time</option>
								<option value="America/Los_Angeles" <?php echo set_select('timezone', 'America/Los_Angeles'); ?>>Pacific Time</option>
								<option value="Europe/London" <?php echo set_select('timezone', 'Europe/London'); ?>>London</option>
								<option value="Europe/Paris" <?php echo set_select('timezone', 'Europe/Paris'); ?>>Paris</option>
								<option value="Asia/Dubai" <?php echo set_select('timezone', 'Asia/Dubai'); ?>>Dubai</option>
								<option value="Asia/Karachi" <?php echo set_select('timezone', 'Asia/Karachi'); ?>>Karachi</option>
								<option value="Asia/Tokyo" <?php echo set_select('timezone', 'Asia/Tokyo'); ?>>Tokyo</option>
							</select>
						</div>
					</div>
					<div class="row">
						<div class="form-group col-md-6">
							<label>Currency</label>
							<select class="form-control" id="currency" name="currency">
								<option value="USD" <?php echo set_select('currency', 'USD', TRUE); ?>>USD</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR'); ?>>EUR</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP'); ?>>GBP</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR'); ?>>PKR</option>
								<option value="AED" <?php echo set_select('currency', 'AED'); ?>>AED</option>
							</select>
						</div>
					</div>
				</div>
			</div>
			<div class="row">
				<div class="col-md-12">
					<button type="submit" class="btn btn-success btn-sm">Add User</button>
					<a href="<?php echo base_url();?>clients" class="btn btn-warning btn-sm">Cancel</a>
				</div>
			</div>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	// Show/hide password
	
	  $(document).ready(function(){
		// Handle destination type change
		$('#destination_type').change(function(){
			var type = $(this).val();
			
			if(type == 'trunk') {
				$('#trunk_selection').show();
				$('#agent_selection').hide();
				$('#destination_trunk').attr('required', true);
				$('#destination_agent').attr('required', false);
			} else if(type == 'agent') {
				$('#trunk_selection').hide();
				$('#agent_selection').show();
				$('#destination_trunk').attr('required', false);
				$('#destination_agent').attr('required', true);
				
				// Load available agents
				loadAvailableAgents();
			} else {
				$('#trunk_selection').hide();
				$('#agent_selection').hide();
				$('#destination_trunk').attr('required', false);
				$('#destination_agent').attr('required', false);
			}
		});
		
		// Initialize based on current selection (for edit form)
		var currentType = $('#destination_type').val();
		if(currentType) {
			$('#destination_type').trigger('change');
		}
		
		// Load available agents
		function loadAvailableAgents() {
			$.ajax({
				url: '<?php echo base_url(); ?>clients/get_available_agents',
				type: 'POST',
				dataType: 'json',
				success: function(response) {
					if(response.success) {
						var options = '<option value="">Select Agent</option>';
						$.each(response.agents, function(index, agent) {
							var selected = '';
							<?php if(isset($fields) && $fields->assigned_agent_id): ?>
							if(agent.id == '<?php echo $fields->assigned_agent_id; ?>') {
								selected = 'selected';
							}
							<?php endif; ?>
							
							options += '<option value="' + agent.id + '" ' + selected + '>' + 
									   agent.name + ' (' + (agent.defaultuser || agent.username) + ')' + 
									   '</option>';
						});
						$('#destination_agent').html(options);
					}
				},
				error: function() {
					alert('Error loading agents');
				}
			});
		}
	});
	</script>

</body>

</html>