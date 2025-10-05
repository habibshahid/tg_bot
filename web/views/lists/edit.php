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
            <h3 class="mt-4">Edit Forwarding Route</h3>
            <?php $attributes = array('class' => 'form-signin');
            echo form_open("lists/edit", $attributes); ?>
            <div class="row">
                <div class="form-group col">
                    <label>Destination Name</label>
                    <input class="form-control" id="list_name" name="list_name"
                           value="<?php echo $fields->list_name; ?>" readonly/>
                </div>
                <div class="form-group col">
					<label>Caller ID</label>
					<input class="form-control" id="callerid" name="callerid" placeholder="Enter Caller Id" value="<?php echo $fields->callerid; ?>" required />
				</div>

                <div class="form-group col">
                    <label>Gateway</label>
					<select class="form-control" id="gateway_name" name="gateway_name" required />
						<option value="">Select Gateway</option>
						<?php foreach($gateways as $gateway){ ?>
						<option value="<?php echo $gateway->name;?>" <?php if($fields->gateway_name == $gateway->name){echo 'selected="selected"';} ?>><?php echo $gateway->name;?></option>
						<?php } ?>
					</select>
                </div>
            </div>
            <div class="row">
                <div class="form-group col-lg-6 col-sm-12">
                    <label>Music on Hold</label>
                    <select class="form-control" id="moh_name" name="moh_name" />
                    <option value="">Select MOH Class</option>
                    <?php foreach ($mohs as $moh) { ?>
                        <option value="<?php echo $moh->name; ?>" <?php if ($moh->name == $fields->moh_name) {
                            echo 'selected="selected"';
                        } ?>><?php echo $moh->name; ?></option>
                    <?php } ?>
                    </select>
                </div>
                <div class="form-group col-lg-6 col-sm-12">
                    <label>IVR</label>
                    <select class="form-control" id="ivr_id" name="ivr_id" />
                    <option value="">Select IVR</option>
                    <?php foreach ($ivrs as $ivr) { ?>
                        <option value="<?php echo $ivr->id; ?>" <?php if ($ivr->id == $fields->ivr_id) {
                            echo 'selected="selected"';
                        } ?>><?php echo $ivr->ivr_name; ?></option>
                    <?php } ?>
                    </select>
                </div>
				<div class="form-group col">
                    <label>Routing</label>
					<select class="form-control" id="route_queue" name="route_queue" required="">
						<option value="0" <?php if ($fields->route_queue == 0) { echo 'selected="selected"'; } ?>>Route to Admin Mobile</option>
						<option value="1" <?php if ($fields->route_queue == 1) { echo 'selected="selected"'; } ?>>Route to Admin SIP</option>
						<option value="2" <?php if ($fields->route_queue == 2) { echo 'selected="selected"'; } ?>>Route to Admin SIP Trunk</option>
						<option value="3" <?php if ($fields->route_queue == 3) { echo 'selected="selected"'; } ?>>Route to Admin SIP Trunk with IVR</option>
						<option value="4" <?php if ($fields->route_queue == 4) { echo 'selected="selected"'; } ?>>Route to Admin SIP Trunk with IVR Input</option>
					</select>
                </div>
				
            </div>
            <input type="hidden" id="id" name="id" value="<?php echo $fields->id; ?>"/>
            <button type="submit" class="btn btn-success btn-sm">Update List</button>
            <a href="<?php echo base_url(); ?>lists" class="btn btn-warning btn-sm">Cancel</a>
            <?php echo form_close(); ?>
            <hr>
            <div class="panel-body">
				<div class="card-header tab-card-header">
					<ul class="nav nav-tabs card-header-tabs" id="myTab" role="tablist">
						<li class="nav-item">
							<a class="nav-link active show" id="two-tab" data-toggle="tab" href="#two" role="tab" aria-controls="Two" aria-selected="false">Upload Admin Numbers</a>
						</li>
						<li class="nav-item">
							<a class="nav-link" id="four-tab" data-toggle="tab" href="#four" role="tab" aria-controls="Two" aria-selected="false">Associate SIP Agent</a>
						</li>
					</ul>
				</div>
				<div class="tab-content" id="myTabContent">
					
					<div class="tab-pane fade p-3 active show" id="two" role="tabpanel" aria-labelledby="one-tab">
						<?php echo form_open_multipart('lists/uploadAdminFile'); ?>
							<div class="row">
								<div class="form-group col">
									<span>Select an Excel File (.xls, .xlsx, .csv or .txt)</span>
								</div>
								<div class="form-group col">
									<span class="float-right">
										<a class="btn btn-sm btn-secondary" href="<?php echo base_url(); ?>export/sample_file.xlsx">
											Download Sample
										</a>
									</span>
									<span class="float-right">
										<a class="btn btn-sm btn-danger" href="<?php echo base_url(); ?>lists/deleteAllAdmin/<?php echo $fields->id;?>">
											Delete All
										</a>
									</span>
								</div>
							</div>
							<div class="row">
								<div class="col">
									<input required type="file" id="file-0a" name="userfile" class="default file"
										   accept=".csv, .txt, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"/>
									<input type='hidden' id="admin_list_id" name="admin_list_id" value="<?php echo $fields->id; ?>"/>
								</div>
							</div>
							<div class="box-footer">
								<input type="submit" class="btn btn-sm btn-primary" value="Upload">
								<!--<button type="submit" class="btn btn-success"><i class="fa fa-check"> </i> Add New List</button>-->
							</div>
						<?php echo form_close(); ?>
						<h6 class="mt-4">Admin Numbers
							<a href="#addAdminNumber" data-target="#addAdminNumber" data-toggle="modal"
							   class="btn btn-sm btn-success float-right">
								Add New <i class="fa fa-plus"></i>
							</a>
						</h6>
						<br>
						<table id="admin_table" class="table table-striped table-bordered" style="width:100%">
							<thead>
							<th>Destination</th>
							<th>SIP Trunk</th>
							<th>Status</th>
							<th>Actions</th>
							</thead>
							<tbody>
							<?php foreach ($adminNumbers as $number) { ?>
								<tr>
									<td><?php echo $number->number; ?></td>
									<td><?php echo $number->sip_trunk; ?></td>
									<td><?php if($number->status == 0) {echo 'Available';}elseif($number->status == 1){echo 'Busy';} ?></td>
									<td>
										<a href="<?php echo base_url(); ?>lists/deleteAdminNumber/<?php echo $number->id; ?>"
										   class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
									</td>
								</tr>
							<?php } ?>
							</tbody>
						</table>
					</div>
					
					<div class="tab-pane fade p-3" id="four" role="tabpanel" aria-labelledby="one-tab">
						<h6 class="mt-4">Numbers
							<a href="#addNewAgents" data-target="#addNewAgents" data-toggle="modal"
							   class="btn btn-sm btn-success float-right">
								Add New <i class="fa fa-plus"></i>
							</a>
						</h6>
						<br>
						<table id="agents_table" class="table table-striped table-bordered" style="width:100%">
							<thead>
							<th>Agent</th>
							<th>Actions</th>
							</thead>
							<tbody>
							<?php foreach ($queueAgents as $agent) { ?>
								<tr>
									<td><?php echo $agent->membername; ?></td>
									<td>
										<a href="<?php echo base_url(); ?>lists/deleteAgent/<?php echo $agent->uniqueid; ?>/<?php echo $fields->id; ?>"
										   class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Delete</a>
									</td>
								</tr>
							<?php } ?>
							</tbody>
						</table>
					</div>
				</div>
            </div>
        </div>
    </div>
    <!-- /#page-content-wrapper -->
</div>
<!-- /#wrapper -->
<div aria-hidden="true" aria-labelledby="myModalLabel" role="dialog" tabindex="-1" id="addNumber" class="modal fade">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button aria-hidden="true" data-dismiss="modal" class="close" type="button"><i class="fa fa-times"></i>
                </button>
                <h4 class="modal-title">Add New Number</h4>
            </div>
            <div class="modal-body">
                <?php echo form_open_multipart('lists/addNumber'); ?>
                <input type="hidden" id="list_id" name="list_id" value="<?php echo $fields->id; ?>">
                <input type='text' id="number" name='number' class="form-control" required
                       placeholder="Enter Destination Number"/>
                <hr>
                <input type='submit' class='btn btn-success btn-sm' name='submit' value='Add number'/>
                </form>
            </div>
        </div>
    </div>
</div>

<div aria-hidden="true" aria-labelledby="myModalLabel" role="dialog" tabindex="-1" id="addAdminNumber" class="modal fade">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button aria-hidden="true" data-dismiss="modal" class="close" type="button"><i class="fa fa-times"></i>
                </button>
                <h4 class="modal-title">Add New Admin Number</h4>
            </div>
            <div class="modal-body">
                <?php echo form_open_multipart('lists/addAdminNumber'); ?>
					<input type="hidden" id="admin_list_id" name="admin_list_id" value="<?php echo $fields->id; ?>">
					<input type='text' id="admin_number" name='admin_number' class="form-control" required
						   placeholder="Enter Admin Number"/>
					
					<select class="form-control" id="sip_trunk" name="sip_trunk" required />
						<option value="">Select Admin Gateway</option>
						<?php foreach($gateways as $gateway){ ?>
						<option value="<?php echo $gateway->name;?>"><?php echo $gateway->name;?></option>
						<?php } ?>
					</select>
					<hr>
					<input type='submit' class='btn btn-success btn-sm' name='submit' value='Add Admin number'/>
                </form>
            </div>
        </div>
    </div>
</div>

<div aria-hidden="true" aria-labelledby="myModalLabel" role="dialog" tabindex="-1" id="addFwdNumber" class="modal fade">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button aria-hidden="true" data-dismiss="modal" class="close" type="button"><i class="fa fa-times"></i>
                </button>
                <h4 class="modal-title">Add New FWD Number</h4>
            </div>
            <div class="modal-body">
                <?php echo form_open_multipart('lists/addFwdNumber'); ?>
                <input type="hidden" id="fwd_list_id" name="fwd_list_id" value="<?php echo $fields->id; ?>">
                <input type='text' id="fwd_number" name='fwd_number' class="form-control" required
                       placeholder="Enter FWD Number"/>
                <hr>
                <input type='submit' class='btn btn-success btn-sm' name='submit' value='Add FWD number'/>
                </form>
            </div>
        </div>
    </div>
</div>

<div aria-hidden="true" aria-labelledby="myModalLabel" role="dialog" tabindex="-1" id="addNewAgents" class="modal fade">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                
                <h4 class="modal-title">Select Agents
				<button aria-hidden="true" data-dismiss="modal" class="close" type="button"><i class="fa fa-times"></i>
				</button>
				</h4>
            </div>
            <div class="modal-body">
               <table id="all_agents_table" class="table table-striped table-bordered" style="width:100%">
					<thead>
					<th>Agent</th>
					<th>Actions</th>
					</thead>
					<tbody>
					<?php foreach ($agents as $agent) { ?>
						<tr>
							<td><?php echo $agent->name; ?></td>
							<td>
								<a href="<?php echo base_url(); ?>lists/addAgent/<?php echo $agent->id; ?>/<?php echo $fields->id; ?>"
								   class="btn btn-danger btn-sm"><i class="fa fa-times"></i> Associate</a>
							</td>
						</tr>
					<?php } ?>
					</tbody>
				</table>
            </div>
        </div>
    </div>
</div>
<!-- Bootstrap core JavaScript -->
<?php $this->load->view('templates/footer'); ?>
<script>
    $(document).ready(function () {
        $('#cdrs_table').DataTable();
		$('#admin_table').DataTable();
		$('#fwd_table').DataTable();
		$('#agents_table').DataTable();
		$('#all_agents_table').DataTable();
    });
</script>
</body>

</html>
